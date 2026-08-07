import { Injectable } from '@nestjs/common';
import {
  ConflictException,
  ErrorCode,
  ForbiddenException,
  NotFoundException,
} from '@healthflow/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload';
import type { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

export interface PatientPublic {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string | null;
  bloodType: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto, actor: JwtPayload): Promise<PatientPublic> {
    if (!actor.roles.includes('PATIENT') && !actor.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'Only patients can create a patient profile',
      );
    }

    const existing = await this.prisma.patient.findUnique({ where: { userId: actor.sub } });
    if (existing) {
      throw new ConflictException(ErrorCode.CONFLICT, 'Patient profile already exists');
    }

    const patient = await this.prisma.patient.create({
      data: {
        userId: actor.sub,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        phone: dto.phone,
        bloodType: dto.bloodType,
      },
    });

    return this.toPublic(patient);
  }

  async getMe(actor: JwtPayload): Promise<PatientPublic> {
    const patient = await this.prisma.patient.findUnique({ where: { userId: actor.sub } });
    if (!patient) {
      throw new NotFoundException(ErrorCode.PATIENT_NOT_FOUND, 'Patient profile not found');
    }
    return this.toPublic(patient);
  }

  /**
   * Patients may only read their own record.
   * Doctors and admins may read any patient (demo policy; tighten with care-team later).
   */
  async getById(id: string, actor: JwtPayload): Promise<PatientPublic> {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException(ErrorCode.PATIENT_NOT_FOUND, 'Patient not found');
    }

    const isSelf = patient.userId === actor.sub;
    const isPrivileged = actor.roles.includes('ADMIN') || actor.roles.includes('DOCTOR');
    if (!isSelf && !isPrivileged) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'You are not allowed to access this patient record',
      );
    }

    return this.toPublic(patient);
  }

  async update(id: string, dto: UpdatePatientDto, actor: JwtPayload): Promise<PatientPublic> {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException(ErrorCode.PATIENT_NOT_FOUND, 'Patient not found');
    }

    const isSelf = patient.userId === actor.sub;
    const isAdmin = actor.roles.includes('ADMIN');
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException(ErrorCode.ACCESS_DENIED, 'Cannot update this patient profile');
    }

    const updated = await this.prisma.patient.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        bloodType: dto.bloodType,
      },
    });

    return this.toPublic(updated);
  }

  private toPublic(patient: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    phone: string | null;
    bloodType: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PatientPublic {
    return {
      id: patient.id,
      userId: patient.userId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
      phone: patient.phone,
      bloodType: patient.bloodType,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
    };
  }
}
