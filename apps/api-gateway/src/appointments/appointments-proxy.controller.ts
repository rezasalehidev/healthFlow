import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY, type RequestWithContext } from '@healthflow/common';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/auth.decorators';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProxyService } from '../proxy/proxy.service';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('api/v1/appointments')
@UseGuards(RolesGuard, PermissionsGuard)
export class AppointmentsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post()
  @Roles('PATIENT', 'ADMIN')
  @ApiOperation({ summary: 'Book appointment (distributed lock + conflict checks)' })
  async create(@Body() body: unknown, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('POST', '/api/v1/appointments', req, res, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by id' })
  async getById(@Param('id') id: string, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('GET', `/api/v1/appointments/${id}`, req, res);
  }

  @Post(':id/confirm')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Confirm appointment' })
  async confirm(@Param('id') id: string, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('POST', `/api/v1/appointments/${id}/confirm`, req, res);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel appointment' })
  async cancel(@Param('id') id: string, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('POST', `/api/v1/appointments/${id}/cancel`, req, res);
  }

  @Post(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule appointment' })
  async reschedule(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('POST', `/api/v1/appointments/${id}/reschedule`, req, res, body);
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
      service: 'appointment',
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
