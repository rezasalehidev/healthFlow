import { UnauthorizedException, ErrorCode } from '@healthflow/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  const refreshTokenFindFirst = jest.fn();
  const refreshTokenUpdateMany = jest.fn();
  const userFindUnique = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUnique,
      create: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      findFirst: refreshTokenFindFirst,
      create: jest.fn(),
      update: jest.fn(),
      updateMany: refreshTokenUpdateMany,
    },
  } as unknown as PrismaService;

  const jwt = {
    signAsync: jest.fn().mockResolvedValue('access.jwt.token'),
  } as unknown as JwtService;

  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret-min-32-chars!!';
      throw new Error(`missing ${key}`);
    }),
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_ACCESS_TTL') return '15m';
      if (key === 'JWT_REFRESH_TTL') return '7d';
      return fallback;
    }),
  } as unknown as ConfigService;

  const service = new AuthService(prisma, jwt, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addDuration', () => {
    it('parses day and minute TTLs', () => {
      const base = new Date('2026-01-01T00:00:00.000Z');
      expect(service.addDuration(base, '15m').toISOString()).toBe('2026-01-01T00:15:00.000Z');
      expect(service.addDuration(base, '1d').toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });
  });

  describe('hashToken', () => {
    it('returns stable sha256 hex', () => {
      expect(service.hashToken('abc')).toBe(service.hashToken('abc'));
      expect(service.hashToken('abc')).not.toBe(service.hashToken('abcd'));
      expect(service.hashToken('abc')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('refresh rotation', () => {
    it('revokes the whole family on refresh token reuse', async () => {
      refreshTokenFindFirst.mockResolvedValue({
        id: 'rt-1',
        familyId: 'fam-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'u1', email: 'p@example.com', status: 'ACTIVE', roles: [] },
      });
      refreshTokenUpdateMany.mockResolvedValue({ count: 2 });

      await expect(service.refresh('stolen-token')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refresh('stolen-token')).rejects.toMatchObject({
        code: ErrorCode.TOKEN_REUSE_DETECTED,
      });

      expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('login', () => {
    it('rejects unknown users with INVALID_CREDENTIALS', async () => {
      userFindUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'missing@example.com', password: 'Password1' }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_CREDENTIALS });
    });
  });
});
