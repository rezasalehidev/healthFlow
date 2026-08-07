import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService', () => {
  const patient = {
    id: 'patient-1',
    userId: 'user-patient',
  };

  const created = {
    id: 'mr-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    title: 'Checkup',
    notes: 'Healthy',
    diagnosisCode: 'Z00',
    recordedAt: new Date('2026-08-07T00:00:00.000Z'),
    createdAt: new Date('2026-08-07T00:00:00.000Z'),
    updatedAt: new Date('2026-08-07T00:00:00.000Z'),
  };

  const prisma = {
    patient: { findUnique: jest.fn() },
    medicalRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new MedicalRecordsService(prisma as never, events as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patient.findUnique.mockResolvedValue(patient);
    prisma.medicalRecord.create.mockResolvedValue(created);
  });

  it('creates a medical record and publishes event', async () => {
    const result = await service.create(
      'patient-1',
      { title: 'Checkup', notes: 'Healthy', diagnosisCode: 'Z00' },
      { sub: 'doctor-1', email: 'd@x.com', roles: ['DOCTOR'], permissions: [] },
    );

    expect(result.id).toBe('mr-1');
    expect(events.publish).toHaveBeenCalledWith(
      'medical-record.created',
      expect.objectContaining({ medicalRecordId: 'mr-1' }) as Record<string, unknown>,
    );
  });

  it('forbids patients from creating records', async () => {
    await expect(
      service.create(
        'patient-1',
        { title: 'Hack', notes: 'nope' },
        { sub: 'user-patient', email: 'p@x.com', roles: ['PATIENT'], permissions: [] },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks patient from reading another patient clinical list', async () => {
    await expect(
      service.listForPatient('patient-1', {
        sub: 'other-patient',
        email: 'o@x.com',
        roles: ['PATIENT'],
        permissions: [],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
