import { Injectable } from '@nestjs/common';
import { ErrorCode, ForbiddenException, NotFoundException } from '@healthflow/common';
import { ROUTING_KEYS } from '@healthflow/messaging';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload';
import { ClinicalEventPublisher } from '../events/clinical-event.publisher';
import type { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/prescription.dto';

export type PrescriptionStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED';

export interface PrescriptionPublic {
  id: string;
  patientId: string;
  doctorId: string;
  medicalRecordId: string | null;
  medication: string;
  dosage: string;
  instructions: string | null;
  status: PrescriptionStatus;
  prescribedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ClinicalEventPublisher,
  ) {}

  async create(
    patientId: string,
    dto: CreatePrescriptionDto,
    actor: JwtPayload,
  ): Promise<PrescriptionPublic> {
    this.assertDoctorOrAdmin(actor);
    await this.requirePatient(patientId);

    if (dto.medicalRecordId) {
      const record = await this.prisma.medicalRecord.findUnique({
        where: { id: dto.medicalRecordId },
      });
      if (!record || record.patientId !== patientId) {
        throw new NotFoundException(
          ErrorCode.MEDICAL_RECORD_NOT_FOUND,
          'Medical record not found for this patient',
        );
      }
    }

    const prescription = await this.prisma.$transaction(async (tx) => {
      const row = await tx.prescription.create({
        data: {
          patientId,
          doctorId: actor.sub,
          medicalRecordId: dto.medicalRecordId,
          medication: dto.medication,
          dosage: dto.dosage,
          instructions: dto.instructions,
        },
      });

      await this.events.publish(
        ROUTING_KEYS.prescriptionCreated,
        {
          prescriptionId: row.id,
          patientId: row.patientId,
          doctorId: row.doctorId,
          medication: row.medication,
        },
        tx,
      );

      return row;
    });

    return this.toPublic(prescription);
  }

  async listForPatient(patientId: string, actor: JwtPayload): Promise<PrescriptionPublic[]> {
    const patient = await this.requirePatient(patientId);
    this.assertCanReadPatientClinical(patient.userId, actor);

    const rows = await this.prisma.prescription.findMany({
      where: { patientId },
      orderBy: { prescribedAt: 'desc' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async getById(id: string, actor: JwtPayload): Promise<PrescriptionPublic> {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!prescription) {
      throw new NotFoundException(ErrorCode.PRESCRIPTION_NOT_FOUND, 'Prescription not found');
    }
    this.assertCanReadPatientClinical(prescription.patient.userId, actor);
    return this.toPublic(prescription);
  }

  async updateStatus(
    id: string,
    dto: UpdatePrescriptionStatusDto,
    actor: JwtPayload,
  ): Promise<PrescriptionPublic> {
    this.assertDoctorOrAdmin(actor);
    const existing = await this.prisma.prescription.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(ErrorCode.PRESCRIPTION_NOT_FOUND, 'Prescription not found');
    }

    const updated = await this.prisma.prescription.update({
      where: { id },
      data: { status: dto.status },
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
        'Only doctors can create or update prescriptions',
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
    medicalRecordId: string | null;
    medication: string;
    dosage: string;
    instructions: string | null;
    status: PrescriptionStatus;
    prescribedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): PrescriptionPublic {
    return {
      id: row.id,
      patientId: row.patientId,
      doctorId: row.doctorId,
      medicalRecordId: row.medicalRecordId,
      medication: row.medication,
      dosage: row.dosage,
      instructions: row.instructions,
      status: row.status,
      prescribedAt: row.prescribedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
