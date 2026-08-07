import { Injectable, Logger } from '@nestjs/common';
import type { Options } from 'amqplib';
import { createEnvelope, type DomainEventEnvelope } from './envelope';
import { RabbitMqService } from './rabbitmq.service';
import { EXCHANGES, HEADER_ORIGINAL_ROUTING_KEY, HEADER_RETRY_COUNT } from './topology';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(private readonly rabbit: RabbitMqService) {}

  async publish(
    routingKey: string,
    input: {
      type: string;
      producer: string;
      payload: Record<string, unknown>;
      eventId?: string;
      correlationId?: string;
    },
  ): Promise<DomainEventEnvelope> {
    const envelope = createEnvelope(input);
    const channel = await this.rabbit.getChannel();
    const ok = channel.publish(
      EXCHANGES.events,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      {
        contentType: 'application/json',
        deliveryMode: 2,
        messageId: envelope.eventId,
        correlationId: envelope.correlationId,
        headers: {
          [HEADER_ORIGINAL_ROUTING_KEY]: routingKey,
          [HEADER_RETRY_COUNT]: 0,
        },
        timestamp: Date.now(),
      } satisfies Options.Publish,
    );

    if (!ok) {
      this.logger.warn({ message: 'Publish buffer full', routingKey, eventId: envelope.eventId });
    } else {
      this.logger.log({ message: 'event published', routingKey, eventId: envelope.eventId });
    }

    return envelope;
  }

  async publishToRetry(
    retryQueueRoutingKey: string,
    body: Buffer,
    headers: Record<string, unknown>,
  ): Promise<void> {
    const channel = await this.rabbit.getChannel();
    channel.publish(EXCHANGES.retry, retryQueueRoutingKey, body, {
      contentType: 'application/json',
      deliveryMode: 2,
      headers,
      persistent: true,
    });
  }

  async publishToDlq(body: Buffer, headers: Record<string, unknown>): Promise<void> {
    const channel = await this.rabbit.getChannel();
    channel.publish(EXCHANGES.dlq, '', body, {
      contentType: 'application/json',
      deliveryMode: 2,
      headers,
      persistent: true,
    });
  }
}
