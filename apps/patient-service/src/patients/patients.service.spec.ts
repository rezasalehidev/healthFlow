import { ErrorCode } from '@healthflow/common';
import { PatientsService } from './patients.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('PatientsService access control', () => {
  const patient = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    firstName: 'Pat',
    lastName: 'Ent',
    dateOfBirth: new Date('1990-05-01'),
    phone: null,
    bloodType: 'O+',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const findUnique = jest.fn();
  const prisma = {
    patient: {
      findUnique,
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new PatientsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(patient);
  });

  it('allows a patient to read their own record', async () => {
    const result = await service.getById(patient.id, {
      sub: patient.userId,
      email: 'p@example.com',
      roles: ['PATIENT'],
      permissions: [],
    });
    expect(result.id).toBe(patient.id);
    expect(result.bloodType).toBe('O+');
  });

  it('blocks a patient from reading another patient record', async () => {
    await expect(
      service.getById(patient.id, {
        sub: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        email: 'other@example.com',
        roles: ['PATIENT'],
        permissions: [],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.ACCESS_DENIED });
  });

  it('allows doctors to read patient records', async () => {
    const result = await service.getById(patient.id, {
      sub: 'doctor-user',
      email: 'd@example.com',
      roles: ['DOCTOR'],
      permissions: ['patients:read'],
    });
    expect(result.firstName).toBe('Pat');
  });
});
