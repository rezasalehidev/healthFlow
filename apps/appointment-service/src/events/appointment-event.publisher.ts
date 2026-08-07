import { Injectable, Logger } from '@nestjs/common';
import { EventPublisher } from '@healthflow/messaging';

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

/**
 * Publishes appointment domain events to RabbitMQ.
 * Failures are logged but do not roll back the booking (transactional outbox is the prod upgrade).
 */
@Injectable()
export class AppointmentEventPublisher {
  private readonly logger = new Logger(AppointmentEventPublisher.name);
  readonly published: DomainEvent[] = [];

  constructor(private readonly events: EventPublisher) {}

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
    try {
      await this.events.publish(event.type, {
        type: event.type,
        producer: event.producer,
        payload: event.payload,
        eventId: event.eventId,
        correlationId: event.correlationId,
      });
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to publish domain event (booking already committed)',
        type: event.type,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : error,
        hint: 'Use transactional outbox for at-least-once durability',
      });
    }
  }
}
