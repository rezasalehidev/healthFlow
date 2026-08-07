import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY, type RequestWithContext } from '@healthflow/common';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/auth.decorators';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProxyService } from '../proxy/proxy.service';

@ApiTags('prescriptions')
@ApiBearerAuth()
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
export class PrescriptionsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post('api/v1/patients/:patientId/prescriptions')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create prescription for a patient' })
  async create(
    @Param('patientId') patientId: string,
    @Body() body: unknown,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('POST', `/api/v1/patients/${patientId}/prescriptions`, req, res, body);
  }

  @Get('api/v1/patients/:patientId/prescriptions')
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'List prescriptions for a patient' })
  async list(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('GET', `/api/v1/patients/${patientId}/prescriptions`, req, res);
  }

  @Get('api/v1/prescriptions/:id')
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get prescription by id' })
  async getById(@Param('id') id: string, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('GET', `/api/v1/prescriptions/${id}`, req, res);
  }

  @Patch('api/v1/prescriptions/:id/status')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update prescription status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('PATCH', `/api/v1/prescriptions/${id}/status`, req, res, body);
  }

  private async forward(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    req: RequestWithContext,
    res: Response,
    body?: unknown,
  ): Promise<void> {
    const expressReq = req as RequestWithContext & Request;
    const result = await this.proxy.forward({
      service: 'patient',
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
