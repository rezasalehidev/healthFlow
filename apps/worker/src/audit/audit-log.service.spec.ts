import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('inserts audit documents', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new AuditLogService({ create } as never);

    const result = await service.record({
      eventId: 'e1',
      type: 'appointment.created',
      occurredAt: '2026-08-07T00:00:00.000Z',
      producer: 'appointment-service',
      payload: { appointmentId: 'a1' },
    });

    expect(result.inserted).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e1',
        type: 'appointment.created',
        sourceQueue: 'healthflow.audit',
      }) as Record<string, unknown>,
    );
  });

  it('treats duplicate key as idempotent skip', async () => {
    const create = jest.fn().mockRejectedValue({ code: 11000 });
    const service = new AuditLogService({ create } as never);

    const result = await service.record({
      eventId: 'e1',
      type: 'appointment.created',
      occurredAt: '2026-08-07T00:00:00.000Z',
      producer: 'appointment-service',
      payload: {},
    });

    expect(result.inserted).toBe(false);
  });
});
