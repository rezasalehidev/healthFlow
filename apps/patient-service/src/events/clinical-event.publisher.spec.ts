import { ClinicalEventPublisher } from './clinical-event.publisher';

describe('ClinicalEventPublisher', () => {
  it('writes an outbox row instead of publishing to the broker', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { outboxEvent: { create } };
    const publisher = new ClinicalEventPublisher(prisma as never);

    await publisher.publish('medical-record.created', { medicalRecordId: 'mr-1' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'medical-record.created',
        routingKey: 'medical-record.created',
      }) as Record<string, unknown>,
    });
    expect(publisher.published).toHaveLength(1);
  });
});
