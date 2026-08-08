import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export type DomainEventType =
  | 'appointment.created'
  | 'appointment.confirmed'
  | 'appointment.cancelled'
  | 'appointment.rescheduled'
  | 'appointment.completed'
  | 'appointment.no_show';

export interface DomainEvent {
  eventId: string;
  type: DomainEventType;
  occurredAt: string;
  correlationId?: string;
  producer: 'appointment-service';
  payload: Record<string, unknown>;
}

type DbClient = PrismaService | Prisma.TransactionClient;

/**
 * Enqueues domain events into the transactional outbox (same DB tx as the mutation).
 * A relay process publishes PENDING rows to RabbitMQ.
 */
@Injectable()
export class AppointmentEventPublisher {
  private readonly logger = new Logger(AppointmentEventPublisher.name);
  readonly published: DomainEvent[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async publish(event: DomainEvent, tx?: Prisma.TransactionClient): Promise<void> {
    const client: DbClient = tx ?? this.prisma;
    await client.outboxEvent.create({
      data: {
        eventId: event.eventId,
        type: event.type,
        routingKey: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        correlationId: event.correlationId,
        occurredAt: new Date(event.occurredAt),
      },
    });
    this.published.push(event);
    this.logger.log({
      message: 'outbox enqueued',
      type: event.type,
      eventId: event.eventId,
    });
  }
}
