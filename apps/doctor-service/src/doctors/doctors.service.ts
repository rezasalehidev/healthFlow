import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  ErrorCode,
  ForbiddenException,
  NotFoundException,
} from '@healthflow/common';
import { CacheService, doctorProfileCacheKey } from '@healthflow/redis';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload';
import type { CreateDoctorDto, ReplaceSchedulesDto, UpdateDoctorDto } from './dto/doctor.dto';

export interface DoctorPublic {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string;
  bio: string | null;
  licenseNumber: string;
  schedules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DoctorsService {
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.cacheTtlSeconds = Number(config.get('DOCTOR_CACHE_TTL_SECONDS', 300));
  }

  async create(dto: CreateDoctorDto, actor: JwtPayload): Promise<DoctorPublic> {
    const targetUserId = dto.userId ?? actor.sub;
    if (dto.userId && dto.userId !== actor.sub && !actor.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'Cannot create doctor for another user',
      );
    }
    if (!actor.roles.includes('ADMIN') && !actor.roles.includes('DOCTOR')) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'Only doctors can create a doctor profile',
      );
    }

    const existing = await this.prisma.doctor.findFirst({
      where: {
        OR: [{ userId: targetUserId }, { licenseNumber: dto.licenseNumber }],
      },
    });
    if (existing) {
      throw new ConflictException(ErrorCode.CONFLICT, 'Doctor profile or license already exists');
    }

    const doctor = await this.prisma.doctor.create({
      data: {
        userId: targetUserId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        specialization: dto.specialization,
        bio: dto.bio,
        licenseNumber: dto.licenseNumber,
      },
      include: { schedules: true },
    });

    return this.toPublic(doctor);
  }

  async findById(id: string): Promise<DoctorPublic> {
    const key = doctorProfileCacheKey(id);
    return this.cache.getOrSet({ key, ttlSeconds: this.cacheTtlSeconds }, async () => {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id },
        include: { schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } },
      });
      if (!doctor) {
        throw new NotFoundException(ErrorCode.DOCTOR_NOT_FOUND, 'Doctor not found');
      }
      return this.toPublic(doctor);
    });
  }

  async list(params: {
    specialization?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: DoctorPublic[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const doctors = await this.prisma.doctor.findMany({
      where: params.specialization
        ? { specialization: { equals: params.specialization, mode: 'insensitive' } }
        : undefined,
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { schedules: true },
    });

    const hasMore = doctors.length > limit;
    const slice = hasMore ? doctors.slice(0, limit) : doctors;
    return {
      items: slice.map((d) => this.toPublic(d)),
      nextCursor: hasMore ? (slice[slice.length - 1]?.id ?? null) : null,
    };
  }

  async update(id: string, dto: UpdateDoctorDto, actor: JwtPayload): Promise<DoctorPublic> {
    const doctor = await this.prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      throw new NotFoundException(ErrorCode.DOCTOR_NOT_FOUND, 'Doctor not found');
    }
    this.assertCanMutate(doctor.userId, actor);

    const updated = await this.prisma.doctor.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        specialization: dto.specialization,
        bio: dto.bio,
      },
      include: { schedules: true },
    });

    await this.cache.del(doctorProfileCacheKey(id));
    return this.toPublic(updated);
  }

  async replaceSchedules(
    id: string,
    dto: ReplaceSchedulesDto,
    actor: JwtPayload,
  ): Promise<DoctorPublic> {
    const doctor = await this.prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      throw new NotFoundException(ErrorCode.DOCTOR_NOT_FOUND, 'Doctor not found');
    }
    this.assertCanMutate(doctor.userId, actor);

    for (const slot of dto.schedules) {
      if (slot.startTime >= slot.endTime) {
        throw new ConflictException(ErrorCode.BAD_REQUEST, 'startTime must be before endTime');
      }
    }

    await this.prisma.$transaction([
      this.prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }),
      this.prisma.doctorSchedule.createMany({
        data: dto.schedules.map((slot) => ({
          doctorId: id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      }),
    ]);

    await this.cache.del(doctorProfileCacheKey(id));
    return this.findById(id);
  }

  /**
   * Used by appointment-service over gRPC to validate schedule coverage.
   */
  async checkSlotAvailability(
    doctorId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<{ available: boolean; reason: string }> {
    if (!(startsAt < endsAt)) {
      return { available: false, reason: 'starts_at must be before ends_at' };
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { schedules: true },
    });
    if (!doctor) {
      return { available: false, reason: 'doctor_not_found' };
    }

    const dayOfWeek = startsAt.getUTCDay();
    const startHm = this.toUtcHm(startsAt);
    const endHm = this.toUtcHm(endsAt);

    if (startsAt.getUTCDay() !== endsAt.getUTCDay()) {
      return { available: false, reason: 'slot_must_be_within_single_utc_day' };
    }

    const covers = doctor.schedules.some(
      (slot) => slot.dayOfWeek === dayOfWeek && slot.startTime <= startHm && slot.endTime >= endHm,
    );

    if (!covers) {
      return { available: false, reason: 'outside_working_hours' };
    }

    return { available: true, reason: 'ok' };
  }

  private toUtcHm(date: Date): string {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private assertCanMutate(ownerUserId: string, actor: JwtPayload): void {
    if (actor.roles.includes('ADMIN') || actor.sub === ownerUserId) {
      return;
    }
    throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Cannot modify this doctor profile');
  }

  private toPublic(doctor: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    specialization: string;
    bio: string | null;
    licenseNumber: string;
    createdAt: Date;
    updatedAt: Date;
    schedules: Array<{
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
  }): DoctorPublic {
    return {
      id: doctor.id,
      userId: doctor.userId,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      bio: doctor.bio,
      licenseNumber: doctor.licenseNumber,
      schedules: doctor.schedules.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      createdAt: doctor.createdAt.toISOString(),
      updatedAt: doctor.updatedAt.toISOString(),
    };
  }
}
