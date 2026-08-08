import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ROUTING_KEYS } from '@healthflow/messaging';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export type ClinicalEventType =
  | typeof ROUTING_KEYS.medicalRecordCreated
  | typeof ROUTING_KEYS.medicalRecordUpdated
  | typeof ROUTING_KEYS.prescriptionCreated;

type DbClient = PrismaService | Prisma.TransactionClient;

/**
 * Enqueues clinical domain events into the transactional outbox.
 * OutboxRelayService publishes PENDING rows to RabbitMQ.
 */
@Injectable()
export class ClinicalEventPublisher {
  private readonly logger = new Logger(ClinicalEventPublisher.name);
  readonly published: Array<{ type: string; payload: Record<string, unknown>; eventId: string }> =
    [];

  constructor(private readonly prisma: PrismaService) {}

  async publish(
    type: ClinicalEventType,
    payload: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const eventId = randomUUID();
    const occurredAt = new Date();
    const client: DbClient = tx ?? this.prisma;

    await client.outboxEvent.create({
      data: {
        eventId,
        type,
        routingKey: type,
        payload: payload as Prisma.InputJsonValue,
        occurredAt,
      },
    });

    this.published.push({ type, payload, eventId });
    this.logger.log({ message: 'clinical outbox enqueued', type, eventId });
  }
}
