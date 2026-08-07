import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import {
  EventPublisher,
  HEADER_ORIGINAL_ROUTING_KEY,
  HEADER_RETRY_COUNT,
  InMemoryIdempotencyStore,
  MAX_RETRY_ATTEMPTS,
  QUEUES,
  RabbitMqService,
  nextRetryAttempt,
  retryQueueForAttempt,
  shouldDeadLetter,
  type DomainEventEnvelope,
} from '@healthflow/messaging';
import { EmailNotificationSimulator } from './email-notification.simulator';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);
  private readonly idempotency = new InMemoryIdempotencyStore();

  /** Test seam — force the next handle to throw */
  failNext = false;

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly publisher: EventPublisher,
    private readonly email: EmailNotificationSimulator,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = await this.rabbit.getChannel();
    await channel.prefetch(10);

    await channel.consume(QUEUES.notifications, (msg) => {
      void this.onNotificationMessage(msg);
    });

    await channel.consume(QUEUES.notificationsRequeue, (msg) => {
      void this.onRequeueMessage(msg);
    });

    this.logger.log('Notification consumers started');
  }

  private async onNotificationMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      return;
    }
    const channel = await this.rabbit.getChannel();

    try {
      const envelope = JSON.parse(msg.content.toString('utf8')) as DomainEventEnvelope;
      if (this.idempotency.has(envelope.eventId)) {
        this.logger.warn({ message: 'duplicate event skipped', eventId: envelope.eventId });
        channel.ack(msg);
        return;
      }

      if (this.failNext) {
        this.failNext = false;
        throw new Error('forced failure for retry demo');
      }

      await this.email.sendForEvent(envelope);
      this.idempotency.tryClaim(envelope.eventId);
      channel.ack(msg);
    } catch (error: unknown) {
      this.logger.error({
        message: 'notification processing failed',
        error: error instanceof Error ? error.message : error,
      });
      await this.handleFailure(msg);
    }
  }

  private async handleFailure(msg: ConsumeMessage): Promise<void> {
    const channel = await this.rabbit.getChannel();
    const retryCount = nextRetryAttempt(this.rabbit.getRetryCount(msg));
    const originalRk = this.rabbit.getOriginalRoutingKey(msg, msg.fields.routingKey);

    if (shouldDeadLetter(retryCount, MAX_RETRY_ATTEMPTS)) {
      await this.publisher.publishToDlq(msg.content, {
        ...(msg.properties.headers ?? {}),
        [HEADER_RETRY_COUNT]: retryCount,
        [HEADER_ORIGINAL_ROUTING_KEY]: originalRk,
        'x-healthflow-error': 'max_retries_exceeded',
      });
      channel.ack(msg);
      this.logger.warn({ message: 'event sent to DLQ', retryCount, originalRk });
      return;
    }

    const retryQueue = retryQueueForAttempt(retryCount, {
      s5: QUEUES.notificationsRetry5s,
      s30: QUEUES.notificationsRetry30s,
      s120: QUEUES.notificationsRetry120s,
    });

    await this.publisher.publishToRetry(retryQueue, msg.content, {
      ...(msg.properties.headers ?? {}),
      [HEADER_RETRY_COUNT]: retryCount,
      [HEADER_ORIGINAL_ROUTING_KEY]: originalRk,
    });
    channel.ack(msg);
    this.logger.warn({ message: 'event scheduled for retry', retryCount, retryQueue });
  }

  /** After TTL, retry messages land here and are republished to the events exchange. */
  private async onRequeueMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      return;
    }
    const channel = await this.rabbit.getChannel();
    try {
      const originalRk = this.rabbit.getOriginalRoutingKey(msg, 'appointment.created');
      const headers = {
        ...(msg.properties.headers ?? {}),
      };
      channel.publish('healthflow.events', originalRk, msg.content, {
        contentType: 'application/json',
        deliveryMode: 2,
        headers,
        persistent: true,
      });
      channel.ack(msg);
    } catch (error: unknown) {
      this.logger.error({
        message: 'requeue bridge failed',
        error: error instanceof Error ? error.message : error,
      });
      channel.nack(msg, false, true);
    }
  }
}
