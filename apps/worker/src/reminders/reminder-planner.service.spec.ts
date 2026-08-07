import { ConfigService } from '@nestjs/config';
import { ReminderPlannerService } from './reminder-planner.service';

describe('ReminderPlannerService', () => {
  const findOneAndUpdate = jest.fn();
  const updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
  const model = { findOneAndUpdate, updateMany };
  const config = {
    get: jest.fn((_key: string, fallback?: string) => fallback ?? '24,1'),
  } as unknown as ConfigService;

  const service = new ReminderPlannerService(model as never, config);

  beforeEach(() => {
    jest.clearAllMocks();
    findOneAndUpdate.mockResolvedValue({});
  });

  it('plans 24h and 1h reminders for appointment.created', async () => {
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await service.handleDomainEvent({
      eventId: 'e1',
      type: 'appointment.created',
      occurredAt: new Date().toISOString(),
      producer: 'appointment-service',
      payload: {
        appointmentId: 'appt-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startsAt,
      },
    });

    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { appointmentId: 'appt-1', offsetLabel: '24h' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'pending' }) as Record<string, unknown>,
      }) as Record<string, unknown>,
      { upsert: true, new: true },
    );
  });

  it('cancels pending reminders on appointment.cancelled', async () => {
    await service.handleDomainEvent({
      eventId: 'e2',
      type: 'appointment.cancelled',
      occurredAt: new Date().toISOString(),
      producer: 'appointment-service',
      payload: { appointmentId: 'appt-1' },
    });

    expect(updateMany).toHaveBeenCalledWith(
      { appointmentId: 'appt-1', status: 'pending' },
      { $set: { status: 'cancelled' } },
    );
  });
});
