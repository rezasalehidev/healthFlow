import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import {
  EXCHANGES,
  HEADER_ORIGINAL_ROUTING_KEY,
  HEADER_RETRY_COUNT,
  NOTIFICATION_BINDING_PATTERNS,
  QUEUES,
} from './topology';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private topologyReady = false;

  constructor(private readonly config: ConfigService) {}

  async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const url = this.config.get<string>(
      'RABBITMQ_URL',
      'amqp://healthflow:healthflow@localhost:5672',
    );
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    this.channel.on('error', (error: Error) => {
      this.logger.error({ message: 'RabbitMQ channel error', error: error.message });
    });

    await this.assertTopology(this.channel);
    return this.channel;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore shutdown races
    }
  }

  async assertTopology(channel: Channel): Promise<void> {
    if (this.topologyReady) {
      return;
    }

    await channel.assertExchange(EXCHANGES.events, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.retry, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.dlq, 'fanout', { durable: true });
    await channel.assertExchange(EXCHANGES.requeue, 'fanout', { durable: true });

    await channel.assertQueue(QUEUES.notificationsDlq, { durable: true });
    await channel.bindQueue(QUEUES.notificationsDlq, EXCHANGES.dlq, '');

    await channel.assertQueue(QUEUES.notificationsRequeue, { durable: true });
    await channel.bindQueue(QUEUES.notificationsRequeue, EXCHANGES.requeue, '');

    await channel.assertQueue(QUEUES.notifications, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.dlq,
      },
    });

    for (const pattern of NOTIFICATION_BINDING_PATTERNS) {
      await channel.bindQueue(QUEUES.notifications, EXCHANGES.events, pattern);
    }

    await this.assertRetryQueue(channel, QUEUES.notificationsRetry5s, 5_000);
    await this.assertRetryQueue(channel, QUEUES.notificationsRetry30s, 30_000);
    await this.assertRetryQueue(channel, QUEUES.notificationsRetry120s, 120_000);

    await channel.assertQueue(QUEUES.audit, { durable: true });
    await channel.bindQueue(QUEUES.audit, EXCHANGES.events, '#');

    this.topologyReady = true;
    this.logger.log('RabbitMQ topology asserted');
  }

  private async assertRetryQueue(channel: Channel, queue: string, ttlMs: number): Promise<void> {
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-message-ttl': ttlMs,
        'x-dead-letter-exchange': EXCHANGES.requeue,
      },
    });
    await channel.bindQueue(queue, EXCHANGES.retry, queue);
  }

  getRetryCount(msg: ConsumeMessage): number {
    const headers = msg.properties.headers ?? {};
    const raw: unknown = headers[HEADER_RETRY_COUNT];
    return typeof raw === 'number' ? raw : Number(raw ?? 0) || 0;
  }

  getOriginalRoutingKey(msg: ConsumeMessage, fallback: string): string {
    const headers = msg.properties.headers ?? {};
    const raw: unknown = headers[HEADER_ORIGINAL_ROUTING_KEY];
    return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
  }
}
