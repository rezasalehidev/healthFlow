import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@healthflow/common';
import type { DistributedLockService } from '@healthflow/redis';
import { AppointmentStatus } from '../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { DoctorAvailabilityClientService } from '../doctors/doctor-availability.client';
import { AppointmentEventPublisher } from '../events/appointment-event.publisher';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const create = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();

  const prisma = {
    appointment: { create, findMany, findUnique, update },
  } as unknown as PrismaService;

  const withLock = jest.fn();
  const locks = { withLock } as unknown as DistributedLockService;

  const checkSlot = jest.fn().mockResolvedValue({ available: true, reason: 'ok' });
  const doctorAvailability = { checkSlot } as unknown as DoctorAvailabilityClientService;

  const bus = { publish: jest.fn().mockResolvedValue({}) };
  const events = new AppointmentEventPublisher(bus as never);
  const config = { get: jest.fn().mockReturnValue(10) } as unknown as ConfigService;

  const service = new AppointmentsService(prisma, locks, doctorAvailability, events, config);

  const actor = {
    sub: 'user-1',
    email: 'p@example.com',
    roles: ['PATIENT'],
    permissions: ['appointments:create'],
  };

  const dto = {
    patientId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    doctorId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    startsAt: '2026-08-10T10:00:00.000Z',
    endsAt: '2026-08-10T10:30:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    events.published.length = 0;
    findMany.mockResolvedValue([]);
    create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ...data,
        status: AppointmentStatus.PENDING,
        version: 1,
        notes: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );
    withLock.mockImplementation(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => ({
      acquired: true,
      result: await fn(),
    }));
    checkSlot.mockResolvedValue({ available: true, reason: 'ok' });
  });

  it('detects overlapping ranges', () => {
    const aStart = new Date('2026-08-10T10:00:00.000Z');
    const aEnd = new Date('2026-08-10T10:30:00.000Z');
    expect(
      service.rangesOverlap(
        aStart,
        aEnd,
        new Date('2026-08-10T10:15:00.000Z'),
        new Date('2026-08-10T10:45:00.000Z'),
      ),
    ).toBe(true);
    expect(
      service.rangesOverlap(
        aStart,
        aEnd,
        new Date('2026-08-10T10:30:00.000Z'),
        new Date('2026-08-10T11:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('creates appointment under distributed lock and publishes event', async () => {
    const result = await service.create(dto, actor);

    expect(withLock).toHaveBeenCalled();
    expect(checkSlot).toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
    expect(result.status).toBe(AppointmentStatus.PENDING);
    expect(events.published[0]?.type).toBe('appointment.created');
  });

  it('rejects when lock cannot be acquired', async () => {
    withLock.mockResolvedValueOnce({ acquired: false });

    await expect(service.create(dto, actor)).rejects.toMatchObject({
      code: ErrorCode.APPOINTMENT_ALREADY_BOOKED,
    });
  });

  it('rejects when doctor is unavailable via gRPC', async () => {
    checkSlot.mockResolvedValueOnce({ available: false, reason: 'outside_working_hours' });

    await expect(service.create(dto, actor)).rejects.toMatchObject({
      code: ErrorCode.APPOINTMENT_ALREADY_BOOKED,
    });
  });

  it('rejects overlapping active appointments', async () => {
    findMany.mockResolvedValueOnce([{ id: 'existing' }]);

    await expect(service.create(dto, actor)).rejects.toMatchObject({
      code: ErrorCode.APPOINTMENT_ALREADY_BOOKED,
    });
  });
});
