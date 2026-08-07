import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY, type RequestWithContext } from '@healthflow/common';
import type { Request, Response } from 'express';
import { Permissions, Public, Roles } from './decorators/auth.decorators';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { ProxyService } from '../proxy/proxy.service';

@ApiTags('auth')
@Controller('api/v1/auth')
@UseGuards(RolesGuard, PermissionsGuard)
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new PATIENT account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward('POST', '/api/v1/auth/register', req, res, dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive access + refresh tokens' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward('POST', '/api/v1/auth/login', req, res, dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward('POST', '/api/v1/auth/refresh', req, res, dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ): Promise<void> {
    await this.forward('POST', '/api/v1/auth/logout', req, res, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user profile' })
  async me(@Req() req: RequestWithContext, @Res() res: Response): Promise<void> {
    await this.forward('GET', '/api/v1/auth/me', req, res);
  }

  @Get('admin/ping')
  @ApiBearerAuth()
  @Roles('ADMIN')
  @Permissions('users:read')
  @ApiOperation({ summary: 'RBAC smoke check (ADMIN + users:read)' })
  async adminPing(@Req() req: RequestWithContext, @Res() res: Response): Promise<void> {
    await this.forward('GET', '/api/v1/auth/admin/ping', req, res);
  }

  private async forward(
    method: 'GET' | 'POST',
    path: string,
    req: RequestWithContext,
    res: Response,
    body?: unknown,
  ): Promise<void> {
    const expressReq = req as RequestWithContext & Request;
    const result = await this.proxy.forward({
      service: 'auth',
      method,
      path,
      body,
      correlationId: expressReq[CORRELATION_ID_KEY],
      requestId: expressReq[REQUEST_ID_KEY],
      authorization: expressReq.headers.authorization,
      ip: expressReq.ip,
      userAgent: expressReq.headers['user-agent'],
    });
    res.status(result.status).json(result.data);
  }
}
