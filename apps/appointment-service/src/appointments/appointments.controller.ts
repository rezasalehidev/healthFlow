import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { successResponse } from '@healthflow/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { CreateAppointmentDto, RescheduleAppointmentDto } from './dto/appointment.dto';
import { AppointmentsService } from './appointments.service';

@Controller('api/v1/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @Roles('PATIENT', 'ADMIN')
  async create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: JwtPayload) {
    const appointment = await this.appointments.create(dto, user);
    return successResponse(appointment);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const appointment = await this.appointments.getById(id, user);
    return successResponse(appointment);
  }

  @Post(':id/confirm')
  @Roles('DOCTOR', 'ADMIN')
  async confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const appointment = await this.appointments.confirm(id, user);
    return successResponse(appointment);
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const appointment = await this.appointments.cancel(id, user);
    return successResponse(appointment);
  }

  @Post(':id/reschedule')
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const appointment = await this.appointments.reschedule(id, dto, user);
    return successResponse(appointment);
  }
}
