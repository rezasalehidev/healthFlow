import { ReminderDispatcherService } from './reminder-dispatcher.service';

describe('ReminderDispatcherService', () => {
  it('publishes and marks due jobs as sent', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const job = {
      appointmentId: 'appt-1',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      startsAt: new Date('2026-08-10T10:00:00.000Z'),
      remindAt: new Date('2026-08-09T10:00:00.000Z'),
      offsetLabel: '24h',
      status: 'pending' as string,
      publishedEventId: undefined as string | undefined,
      sentAt: undefined as Date | undefined,
      save,
    };
    const find = jest.fn().mockReturnValue({
      limit: () => ({ exec: jest.fn().mockResolvedValue([job]) }),
    });
    const model = { find };
    const publish = jest.fn().mockResolvedValue({ eventId: 'evt-1' });
    const publisher = { publish };

    const service = new ReminderDispatcherService(model as never, publisher as never);
    const sent = await service.dispatchDue(new Date('2026-08-09T11:00:00.000Z'));

    expect(sent).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      'appointment.reminder',
      expect.objectContaining({
        type: 'appointment.reminder',
        producer: 'worker',
      }) as Record<string, unknown>,
    );
    expect(job.status).toBe('sent');
    expect(job.publishedEventId).toBe('evt-1');
    expect(save).toHaveBeenCalled();
  });
});
