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
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { PatientsService } from './patients.service';

@Controller('api/v1/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post()
  @Roles('PATIENT', 'ADMIN')
  async create(@Body() dto: CreatePatientDto, @CurrentUser() user: JwtPayload) {
    const patient = await this.patients.create(dto, user);
    return successResponse(patient);
  }

  @Get('me')
  @Roles('PATIENT', 'ADMIN')
  async me(@CurrentUser() user: JwtPayload) {
    const patient = await this.patients.getMe(user);
    return successResponse(patient);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const patient = await this.patients.getById(id, user);
    return successResponse(patient);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const patient = await this.patients.update(id, dto, user);
    return successResponse(patient);
  }
}
