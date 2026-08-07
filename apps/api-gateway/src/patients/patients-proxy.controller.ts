import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CORRELATION_ID_KEY, REQUEST_ID_KEY, type RequestWithContext } from '@healthflow/common';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/auth.decorators';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProxyService } from '../proxy/proxy.service';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('api/v1/patients')
@UseGuards(RolesGuard, PermissionsGuard)
export class PatientsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post()
  @Roles('PATIENT', 'ADMIN')
  @ApiOperation({ summary: 'Create patient profile for current user' })
  async create(@Body() body: unknown, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('POST', '/api/v1/patients', req, res, body);
  }

  @Get('me')
  @Roles('PATIENT', 'ADMIN')
  @ApiOperation({ summary: 'Get current patient profile' })
  async me(@Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('GET', '/api/v1/patients/me', req, res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by id (ownership enforced upstream)' })
  async getById(@Param('id') id: string, @Req() req: RequestWithContext, @Res() res: Response) {
    await this.forward('GET', `/api/v1/patients/${id}`, req, res);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient profile' })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ) {
    await this.forward('PATCH', `/api/v1/patients/${id}`, req, res, body);
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
