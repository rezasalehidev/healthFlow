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
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';
import { MedicalRecordsService } from './medical-records.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  @Post('api/v1/patients/:patientId/medical-records')
  @Roles('DOCTOR', 'ADMIN')
  async create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateMedicalRecordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const record = await this.records.create(patientId, dto, user);
    return successResponse(record);
  }

  @Get('api/v1/patients/:patientId/medical-records')
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  async list(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const records = await this.records.listForPatient(patientId, user);
    return successResponse(records);
  }

  @Get('api/v1/medical-records/:id')
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const record = await this.records.getById(id, user);
    return successResponse(record);
  }

  @Patch('api/v1/medical-records/:id')
  @Roles('DOCTOR', 'ADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalRecordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const record = await this.records.update(id, dto, user);
    return successResponse(record);
  }
}
