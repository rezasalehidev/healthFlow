import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  ErrorCode,
  ForbiddenException,
  UnauthorizedException,
} from '@healthflow/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '../rbac/permissions';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './types/jwt-payload';
import type { AuthTokens, PublicUser } from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        ErrorCode.USER_ALREADY_EXISTS,
        'A user with this email already exists',
      );
    }

    const role = await this.prisma.role.findUnique({ where: { name: RoleName.PATIENT } });
    if (!role) {
      throw new ConflictException(ErrorCode.BAD_REQUEST, 'PATIENT role is not seeded');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        roles: { create: [{ roleId: role.id }] },
      },
      include: this.userInclude(),
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      this.extractRoles(user),
      this.extractPermissions(user),
    );
    return { user: this.toPublicUser(user), tokens };
  }

  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.userInclude(),
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      this.extractRoles(user),
      this.extractPermissions(user),
      meta,
    );

    return { user: this.toPublicUser(user), tokens };
  }

  async refresh(
    rawRefreshToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: {
        user: { include: this.userInclude() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException(ErrorCode.TOKEN_INVALID, 'Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.revokeTokenFamily(stored.familyId);
      throw new UnauthorizedException(
        ErrorCode.TOKEN_REUSE_DETECTED,
        'Refresh token reuse detected — session family revoked',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(ErrorCode.TOKEN_EXPIRED, 'Refresh token expired');
    }

    if (stored.user.status !== 'ACTIVE') {
      throw new ForbiddenException(ErrorCode.FORBIDDEN, 'User account is not active');
    }

    const roles = this.extractRoles(stored.user);
    const permissions = this.extractPermissions(stored.user);

    const tokens = await this.createTokenPair(
      stored.user.id,
      stored.user.email,
      roles,
      permissions,
      stored.familyId,
      meta,
    );

    const replacement = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(tokens.refreshToken) },
    });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        replacedById: replacement?.id,
      },
    });

    return tokens;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    if (!stored || stored.revokedAt) {
      return;
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    });
    if (!user) {
      throw new UnauthorizedException(ErrorCode.UNAUTHORIZED, 'User not found');
    }
    return this.toPublicUser(user);
  }

  private async issueTokens(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const familyId = randomUUID();
    return this.createTokenPair(userId, email, roles, permissions, familyId, meta);
  }

  private async createTokenPair(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    familyId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, roles, permissions };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const expiresAt = this.addDuration(new Date(), refreshTtl);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: refreshTtl };
  }

  private async revokeTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private userInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    } as const;
  }

  private extractRoles(user: { roles: Array<{ role: { name: string } }> }): string[] {
    return user.roles.map((ur) => ur.role.name);
  }

  private extractPermissions(user: {
    roles: Array<{
      role: { permissions: Array<{ permission: { code: string } }> };
    }>;
  }): string[] {
    const set = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        set.add(rp.permission.code);
      }
    }
    return [...set].sort();
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    status: string;
    createdAt: Date;
    roles: Array<{
      role: { name: string; permissions: Array<{ permission: { code: string } }> };
    }>;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: this.extractRoles(user),
      permissions: this.extractPermissions(user),
      createdAt: user.createdAt.toISOString(),
    };
  }

  /** Supports simple TTL strings like 15m, 7d, 3600s */
  addDuration(from: Date, ttl: string): Date {
    const match = /^(\d+)([smhd])$/i.exec(ttl.trim());
    if (!match) {
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(from.getTime() + amount * (multipliers[unit] ?? 86_400_000));
  }
}
