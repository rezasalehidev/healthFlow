import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppException,
  ConflictException,
  ErrorCode,
  ForbiddenException,
  NotFoundException,
} from '@healthflow/common';
import { DistributedLockService, appointmentSlotLockKey } from '@healthflow/redis';
import { AppointmentStatus, Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload';
import { DoctorAvailabilityClientService } from '../doctors/doctor-availability.client';
import { AppointmentEventPublisher } from '../events/appointment-event.publisher';
import type { CreateAppointmentDto, RescheduleAppointmentDto } from './dto/appointment.dto';

export interface AppointmentPublic {
  id: string;
  patientId: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const ACTIVE: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

@Injectable()
export class AppointmentsService {
  private readonly lockTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: DistributedLockService,
    private readonly doctorAvailability: DoctorAvailabilityClientService,
    private readonly events: AppointmentEventPublisher,
    config: ConfigService,
  ) {
    this.lockTtlSeconds = Number(config.get('APPOINTMENT_LOCK_TTL_SECONDS', 10));
  }

  async create(dto: CreateAppointmentDto, actor: JwtPayload): Promise<AppointmentPublic> {
    this.assertCanCreate(actor);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertValidRange(startsAt, endsAt);

    const outcome = await this.locks.withLock(
      appointmentSlotLockKey(dto.doctorId, startsAt.toISOString()),
      this.lockTtlSeconds,
      async () => this.createInsideLock(dto, actor, startsAt, endsAt),
    );

    if (!outcome.acquired) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_ALREADY_BOOKED,
        'The appointment slot is being booked by another request',
      );
    }

    return outcome.result;
  }

  private async createInsideLock(
    dto: CreateAppointmentDto,
    actor: JwtPayload,
    startsAt: Date,
    endsAt: Date,
  ): Promise<AppointmentPublic> {
    const availability = await this.doctorAvailability.checkSlot(dto.doctorId, startsAt, endsAt);
    if (!availability.available) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_ALREADY_BOOKED,
        `Doctor is not available (${availability.reason})`,
      );
    }

    const overlap = await this.findOverlap(dto.doctorId, startsAt, endsAt);
    if (overlap) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_ALREADY_BOOKED,
        'The appointment slot is no longer available',
      );
    }

    try {
      const created = await this.prisma.appointment.create({
        data: {
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          startsAt,
          endsAt,
          status: AppointmentStatus.PENDING,
          slotKey: this.slotKey(dto.doctorId, startsAt),
          notes: dto.notes,
          createdBy: actor.sub,
        },
      });

      await this.events.publish({
        eventId: randomUUID(),
        type: 'appointment.created',
        occurredAt: new Date().toISOString(),
        producer: 'appointment-service',
        payload: {
          appointmentId: created.id,
          doctorId: created.doctorId,
          patientId: created.patientId,
        },
      });

      return this.toPublic(created);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          ErrorCode.APPOINTMENT_ALREADY_BOOKED,
          'The appointment slot is no longer available',
        );
      }
      throw error;
    }
  }

  async getById(id: string, actor: JwtPayload): Promise<AppointmentPublic> {
    const appointment = await this.requireAppointment(id);
    this.assertCanRead(actor);
    return this.toPublic(appointment);
  }

  async confirm(id: string, actor: JwtPayload): Promise<AppointmentPublic> {
    const appointment = await this.requireAppointment(id);
    this.assertDoctorOrAdmin(actor);
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_INVALID_STATUS,
        'Only PENDING appointments can be confirmed',
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, version: { increment: 1 } },
    });

    await this.events.publish({
      eventId: randomUUID(),
      type: 'appointment.confirmed',
      occurredAt: new Date().toISOString(),
      producer: 'appointment-service',
      payload: { appointmentId: updated.id },
    });

    return this.toPublic(updated);
  }

  async cancel(id: string, actor: JwtPayload): Promise<AppointmentPublic> {
    const appointment = await this.requireAppointment(id);
    this.assertCanCancel(actor);
    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.COMPLETED
    ) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_INVALID_STATUS,
        'Appointment cannot be cancelled in its current status',
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        slotKey: null,
        version: { increment: 1 },
      },
    });

    await this.events.publish({
      eventId: randomUUID(),
      type: 'appointment.cancelled',
      occurredAt: new Date().toISOString(),
      producer: 'appointment-service',
      payload: { appointmentId: updated.id },
    });

    return this.toPublic(updated);
  }

  async reschedule(
    id: string,
    dto: RescheduleAppointmentDto,
    actor: JwtPayload,
  ): Promise<AppointmentPublic> {
    const appointment = await this.requireAppointment(id);
    this.assertCanCancel(actor);

    if (!ACTIVE.includes(appointment.status)) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_INVALID_STATUS,
        'Only active appointments can be rescheduled',
      );
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertValidRange(startsAt, endsAt);

    const outcome = await this.locks.withLock(
      appointmentSlotLockKey(appointment.doctorId, startsAt.toISOString()),
      this.lockTtlSeconds,
      async () => {
        const availability = await this.doctorAvailability.checkSlot(
          appointment.doctorId,
          startsAt,
          endsAt,
        );
        if (!availability.available) {
          throw new ConflictException(
            ErrorCode.APPOINTMENT_ALREADY_BOOKED,
            `Doctor is not available (${availability.reason})`,
          );
        }

        const overlap = await this.findOverlap(appointment.doctorId, startsAt, endsAt, id);
        if (overlap) {
          throw new ConflictException(
            ErrorCode.APPOINTMENT_ALREADY_BOOKED,
            'The appointment slot is no longer available',
          );
        }

        try {
          return await this.prisma.appointment.update({
            where: { id },
            data: {
              startsAt,
              endsAt,
              slotKey: this.slotKey(appointment.doctorId, startsAt),
              version: { increment: 1 },
            },
          });
        } catch (error: unknown) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException(
              ErrorCode.APPOINTMENT_ALREADY_BOOKED,
              'The appointment slot is no longer available',
            );
          }
          throw error;
        }
      },
    );

    if (!outcome.acquired) {
      throw new ConflictException(
        ErrorCode.APPOINTMENT_ALREADY_BOOKED,
        'The appointment slot is being booked by another request',
      );
    }

    await this.events.publish({
      eventId: randomUUID(),
      type: 'appointment.rescheduled',
      occurredAt: new Date().toISOString(),
      producer: 'appointment-service',
      payload: { appointmentId: outcome.result.id, startsAt: startsAt.toISOString() },
    });

    return this.toPublic(outcome.result);
  }

  /** Exposed for unit tests — overlap detection without DB-specific features. */
  rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart < bEnd && bStart < aEnd;
  }

  private async findOverlap(doctorId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
    const candidates = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { in: ACTIVE },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      take: 1,
    });
    return candidates[0] ?? null;
  }

  private async requireAppointment(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException(ErrorCode.APPOINTMENT_NOT_FOUND, 'Appointment not found');
    }
    return appointment;
  }

  private slotKey(doctorId: string, startsAt: Date): string {
    return `${doctorId}:${startsAt.toISOString()}`;
  }

  private assertValidRange(startsAt: Date, endsAt: Date): void {
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      !(startsAt < endsAt)
    ) {
      throw new AppException(ErrorCode.BAD_REQUEST, 'Invalid appointment time range', 400);
    }
  }

  private assertCanCreate(actor: JwtPayload): void {
    if (actor.roles.includes('ADMIN') || actor.roles.includes('PATIENT')) {
      return;
    }
    throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Only patients can create appointments');
  }

  private assertCanRead(actor: JwtPayload): void {
    if (
      actor.roles.includes('ADMIN') ||
      actor.roles.includes('DOCTOR') ||
      actor.roles.includes('PATIENT')
    ) {
      return;
    }
    throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Cannot view this appointment');
  }

  private assertCanCancel(actor: JwtPayload): void {
    if (
      actor.roles.includes('ADMIN') ||
      actor.roles.includes('DOCTOR') ||
      actor.roles.includes('PATIENT')
    ) {
      return;
    }
    throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Cannot cancel this appointment');
  }

  private assertDoctorOrAdmin(actor: JwtPayload): void {
    if (!actor.roles.includes('ADMIN') && !actor.roles.includes('DOCTOR')) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'Only doctors can confirm appointments',
      );
    }
  }

  private toPublic(row: {
    id: string;
    patientId: string;
    doctorId: string;
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
    notes: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): AppointmentPublic {
    return {
      id: row.id,
      patientId: row.patientId,
      doctorId: row.doctorId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
      notes: row.notes,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
