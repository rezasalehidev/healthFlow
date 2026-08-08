import { OutboxStatus } from '../generated/prisma';
import { OutboxRelayService } from './outbox-relay.service';

describe('OutboxRelayService', () => {
  const findMany = jest.fn();
  const update = jest.fn().mockResolvedValue({});
  const publish = jest.fn().mockResolvedValue({ eventId: 'e1' });
  const prisma = {
    outboxEvent: { findMany, update },
  };
  const config = {
    get: jest.fn((_key: string, fallback?: number) => fallback),
  };

  const service = new OutboxRelayService(prisma as never, { publish } as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes pending rows and marks them published', async () => {
    findMany.mockResolvedValue([
      {
        id: 'ob-1',
        eventId: 'evt-1',
        type: 'appointment.created',
        routingKey: 'appointment.created',
        payload: { appointmentId: 'a1' },
        correlationId: null,
        attempts: 0,
      },
    ]);

    const count = await service.publishPending();

    expect(count).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      'appointment.created',
      expect.objectContaining({
        eventId: 'evt-1',
        type: 'appointment.created',
        producer: 'appointment-service',
      }) as Record<string, unknown>,
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ob-1' },
        data: expect.objectContaining({ status: OutboxStatus.PUBLISHED }) as Record<
          string,
          unknown
        >,
      }) as Record<string, unknown>,
    );
  });

  it('marks FAILED after max attempts', async () => {
    findMany.mockResolvedValue([
      {
        id: 'ob-2',
        eventId: 'evt-2',
        type: 'appointment.confirmed',
        routingKey: 'appointment.confirmed',
        payload: {},
        correlationId: null,
        attempts: 9,
      },
    ]);
    publish.mockRejectedValueOnce(new Error('broker down'));

    const count = await service.publishPending();

    expect(count).toBe(0);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OutboxStatus.FAILED,
          attempts: 10,
        }) as Record<string, unknown>,
      }) as Record<string, unknown>,
    );
  });
});
