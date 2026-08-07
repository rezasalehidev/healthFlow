import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY, type RequestWithContext } from '@healthflow/common';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/auth.decorators';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProxyService } from '../proxy/proxy.service';

@ApiTags('doctors')
@ApiBearerAuth()
@Controller('api/v1/doctors')
@UseGuards(RolesGuard, PermissionsGuard)
export class DoctorsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post()
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create doctor profile' })
  async create(@Body() body: unknown, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('POST', '/api/v1/doctors', req, res, body);
  }

  @Get()
  @ApiOperation({ summary: 'List doctors (cursor pagination)' })
  async list(
    @Req() req: RequestWithContext,
    @Res() res: Response,
    @Query('specialization') specialization?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const params = new URLSearchParams();
    if (specialization) params.set('specialization', specialization);
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    await this.forward('GET', `/api/v1/doctors${qs ? `?${qs}` : ''}`, req, res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor by id (Redis cache-aside upstream)' })
  async getById(@Param('id') id: string, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('GET', `/api/v1/doctors/${id}`, req, res);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update doctor profile (invalidates cache)' })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('PATCH', `/api/v1/doctors/${id}`, req, res, body);
  }

  @Put(':id/schedules')
  @ApiOperation({ summary: 'Replace doctor working schedules' })
  async schedules(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('PUT', `/api/v1/doctors/${id}/schedules`, req, res, body);
  }

  private async forward(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    path: string,
    req: RequestWithContext,
    res: Response,
    body?: unknown,
  ): Promise<void> {
    const expressReq = req as RequestWithContext & Request;
    const result = await this.proxy.forward({
      service: 'doctor',
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
