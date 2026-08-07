import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { successResponse } from '@healthflow/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { CreateDoctorDto, ReplaceSchedulesDto, UpdateDoctorDto } from './dto/doctor.dto';
import { DoctorsService } from './doctors.service';

@Controller('api/v1/doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Post()
  @Roles('DOCTOR', 'ADMIN')
  async create(@Body() dto: CreateDoctorDto, @CurrentUser() user: JwtPayload) {
    const doctor = await this.doctors.create(dto, user);
    return successResponse(doctor);
  }

  @Get()
  async list(
    @Query('specialization') specialization?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.doctors.list({
      specialization,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
    return successResponse(result.items, { nextCursor: result.nextCursor });
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const doctor = await this.doctors.findById(id);
    return successResponse(doctor);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const doctor = await this.doctors.update(id, dto, user);
    return successResponse(doctor);
  }

  @Put(':id/schedules')
  async replaceSchedules(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceSchedulesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const doctor = await this.doctors.replaceSchedules(id, dto, user);
    return successResponse(doctor);
  }
}
