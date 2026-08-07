import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { successResponse } from '@healthflow/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/prescription.dto';
import { PrescriptionsService } from './prescriptions.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post('api/v1/patients/:patientId/prescriptions')
  @Roles('DOCTOR', 'ADMIN')
  async create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const prescription = await this.prescriptions.create(patientId, dto, user);
    return successResponse(prescription);
  }

  @Get('api/v1/patients/:patientId/prescriptions')
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  async list(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const items = await this.prescriptions.listForPatient(patientId, user);
    return successResponse(items);
  }

  @Get('api/v1/prescriptions/:id')
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const prescription = await this.prescriptions.getById(id, user);
    return successResponse(prescription);
  }

  @Patch('api/v1/prescriptions/:id/status')
  @Roles('DOCTOR', 'ADMIN')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const prescription = await this.prescriptions.updateStatus(id, dto, user);
    return successResponse(prescription);
  }
}
