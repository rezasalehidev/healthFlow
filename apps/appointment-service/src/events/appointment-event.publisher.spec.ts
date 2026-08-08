import { AppointmentEventPublisher } from './appointment-event.publisher';

describe('AppointmentEventPublisher', () => {
  it('writes an outbox row instead of publishing to the broker', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { outboxEvent: { create } };
    const publisher = new AppointmentEventPublisher(prisma as never);

    await publisher.publish({
      eventId: 'evt-1',
      type: 'appointment.created',
      occurredAt: '2026-08-08T00:00:00.000Z',
      producer: 'appointment-service',
      payload: { appointmentId: 'a1' },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'evt-1',
        type: 'appointment.created',
        routingKey: 'appointment.created',
      }) as Record<string, unknown>,
    });
    expect(publisher.published).toHaveLength(1);
  });
});
