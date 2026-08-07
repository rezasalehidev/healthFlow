import { PrescriptionsService } from './prescriptions.service';

describe('PrescriptionsService', () => {
  const patient = { id: 'patient-1', userId: 'user-patient' };
  const created = {
    id: 'rx-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    medicalRecordId: null,
    medication: 'Amoxicillin',
    dosage: '500mg',
    instructions: 'twice daily',
    status: 'ACTIVE',
    prescribedAt: new Date('2026-08-07T00:00:00.000Z'),
    createdAt: new Date('2026-08-07T00:00:00.000Z'),
    updatedAt: new Date('2026-08-07T00:00:00.000Z'),
  };

  const prisma = {
    patient: { findUnique: jest.fn() },
    medicalRecord: { findUnique: jest.fn() },
    prescription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new PrescriptionsService(prisma as never, events as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patient.findUnique.mockResolvedValue(patient);
    prisma.prescription.create.mockResolvedValue(created);
  });

  it('creates a prescription and publishes event', async () => {
    const result = await service.create(
      'patient-1',
      { medication: 'Amoxicillin', dosage: '500mg', instructions: 'twice daily' },
      { sub: 'doctor-1', email: 'd@x.com', roles: ['DOCTOR'], permissions: [] },
    );

    expect(result.medication).toBe('Amoxicillin');
    expect(events.publish).toHaveBeenCalledWith(
      'prescription.created',
      expect.objectContaining({ prescriptionId: 'rx-1' }) as Record<string, unknown>,
    );
  });

  it('rejects medicalRecordId that belongs to another patient', async () => {
    prisma.medicalRecord.findUnique.mockResolvedValue({
      id: 'mr-1',
      patientId: 'other-patient',
    });

    await expect(
      service.create(
        'patient-1',
        { medication: 'X', dosage: '1', medicalRecordId: 'mr-1' },
        { sub: 'doctor-1', email: 'd@x.com', roles: ['DOCTOR'], permissions: [] },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
