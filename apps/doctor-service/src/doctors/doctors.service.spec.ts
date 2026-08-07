import { ConfigService } from '@nestjs/config';
import { CacheService } from '@healthflow/redis';
import { ErrorCode } from '@healthflow/common';
import { DoctorsService } from './doctors.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('DoctorsService caching', () => {
  const doctorRow = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    firstName: 'Ada',
    lastName: 'Lovelace',
    specialization: 'Cardiology',
    bio: null,
    licenseNumber: 'LIC-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    schedules: [],
  };

  const findUnique = jest.fn();
  const update = jest.fn();
  const prisma = {
    doctor: { findUnique, findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update },
    doctorSchedule: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const getOrSet = jest.fn();
  const del = jest.fn();
  const cache = { getOrSet, del } as unknown as CacheService;

  const config = {
    get: jest.fn().mockReturnValue(300),
  } as unknown as ConfigService;

  const service = new DoctorsService(prisma, cache, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses cache-aside for findById', async () => {
    getOrSet.mockImplementation(async (_opts, loader: () => Promise<unknown>) => loader());
    findUnique.mockResolvedValue(doctorRow);

    const result = await service.findById(doctorRow.id);

    expect(getOrSet).toHaveBeenCalledWith(
      { key: `doctor:profile:${doctorRow.id}`, ttlSeconds: 300 },
      expect.any(Function),
    );
    expect(result.firstName).toBe('Ada');
    expect(result.id).toBe(doctorRow.id);
  });

  it('invalidates cache on update', async () => {
    findUnique.mockResolvedValue(doctorRow);
    update.mockResolvedValue({ ...doctorRow, firstName: 'Augusta' });

    await service.update(
      doctorRow.id,
      { firstName: 'Augusta' },
      {
        sub: doctorRow.userId,
        email: 'ada@example.com',
        roles: ['DOCTOR'],
        permissions: [],
      },
    );

    expect(del).toHaveBeenCalledWith(`doctor:profile:${doctorRow.id}`);
  });

  it('denies update for non-owner non-admin', async () => {
    findUnique.mockResolvedValue(doctorRow);

    await expect(
      service.update(
        doctorRow.id,
        { firstName: 'Hack' },
        { sub: 'other-user', email: 'x@y.z', roles: ['PATIENT'], permissions: [] },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.ACCESS_DENIED });
    expect(del).not.toHaveBeenCalled();
  });
});
