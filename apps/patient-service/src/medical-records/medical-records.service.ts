import { Injectable } from '@nestjs/common';
import { ErrorCode, ForbiddenException, NotFoundException } from '@healthflow/common';
import { ROUTING_KEYS } from '@healthflow/messaging';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload';
import { ClinicalEventPublisher } from '../events/clinical-event.publisher';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';

export interface MedicalRecordPublic {
  id: string;
  patientId: string;
  doctorId: string;
  title: string;
  notes: string;
  diagnosisCode: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ClinicalEventPublisher,
  ) {}

  async create(
    patientId: string,
    dto: CreateMedicalRecordDto,
    actor: JwtPayload,
  ): Promise<MedicalRecordPublic> {
    this.assertDoctorOrAdmin(actor);
    await this.requirePatient(patientId);

    const record = await this.prisma.medicalRecord.create({
      data: {
        patientId,
        doctorId: actor.sub,
        title: dto.title,
        notes: dto.notes,
        diagnosisCode: dto.diagnosisCode,
      },
    });

    await this.events.publish(ROUTING_KEYS.medicalRecordCreated, {
      medicalRecordId: record.id,
      patientId: record.patientId,
      doctorId: record.doctorId,
      title: record.title,
    });

    return this.toPublic(record);
  }

  async listForPatient(patientId: string, actor: JwtPayload): Promise<MedicalRecordPublic[]> {
    const patient = await this.requirePatient(patientId);
    this.assertCanReadPatientClinical(patient.userId, actor);

    const rows = await this.prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async getById(id: string, actor: JwtPayload): Promise<MedicalRecordPublic> {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!record) {
      throw new NotFoundException(ErrorCode.MEDICAL_RECORD_NOT_FOUND, 'Medical record not found');
    }
    this.assertCanReadPatientClinical(record.patient.userId, actor);
    return this.toPublic(record);
  }

  async update(
    id: string,
    dto: UpdateMedicalRecordDto,
    actor: JwtPayload,
  ): Promise<MedicalRecordPublic> {
    this.assertDoctorOrAdmin(actor);
    const existing = await this.prisma.medicalRecord.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(ErrorCode.MEDICAL_RECORD_NOT_FOUND, 'Medical record not found');
    }

    const isAuthor = existing.doctorId === actor.sub;
    const isAdmin = actor.roles.includes('ADMIN');
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'Only the authoring doctor or an admin can update this record',
      );
    }

    const updated = await this.prisma.medicalRecord.update({
      where: { id },
      data: {
        title: dto.title,
        notes: dto.notes,
        diagnosisCode: dto.diagnosisCode,
      },
    });

    await this.events.publish(ROUTING_KEYS.medicalRecordUpdated, {
      medicalRecordId: updated.id,
      patientId: updated.patientId,
      doctorId: updated.doctorId,
      title: updated.title,
    });

    return this.toPublic(updated);
  }

  private async requirePatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException(ErrorCode.PATIENT_NOT_FOUND, 'Patient not found');
    }
    return patient;
  }

  private assertDoctorOrAdmin(actor: JwtPayload): void {
    if (!actor.roles.includes('DOCTOR') && !actor.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'Only doctors can create or update medical records',
      );
    }
  }

  private assertCanReadPatientClinical(patientUserId: string, actor: JwtPayload): void {
    const isSelf = patientUserId === actor.sub;
    const isPrivileged = actor.roles.includes('ADMIN') || actor.roles.includes('DOCTOR');
    if (!isSelf && !isPrivileged) {
      throw new ForbiddenException(
        ErrorCode.ACCESS_DENIED,
        'You are not allowed to access this clinical data',
      );
    }
  }

  private toPublic(row: {
    id: string;
    patientId: string;
    doctorId: string;
    title: string;
    notes: string;
    diagnosisCode: string | null;
    recordedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): MedicalRecordPublic {
    return {
      id: row.id,
      patientId: row.patientId,
      doctorId: row.doctorId,
      title: row.title,
      notes: row.notes,
      diagnosisCode: row.diagnosisCode,
      recordedAt: row.recordedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
