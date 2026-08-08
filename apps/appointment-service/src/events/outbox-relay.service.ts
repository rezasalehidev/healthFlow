import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPublisher } from '@healthflow/messaging';
import { OutboxStatus } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Polls PENDING outbox rows and publishes them to RabbitMQ (at-least-once).
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly pollMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    config: ConfigService,
  ) {
    this.batchSize = Number(config.get('OUTBOX_BATCH_SIZE', 50));
    this.maxAttempts = Number(config.get('OUTBOX_MAX_ATTEMPTS', 10));
    this.pollMs = Number(config.get('OUTBOX_POLL_INTERVAL_MS', 2000));
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollMs);
    this.timer.unref?.();
    this.logger.log({ message: 'outbox relay started', pollMs: this.pollMs });
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.publishPending();
    } catch (error: unknown) {
      this.logger.error({
        message: 'outbox relay tick failed',
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      this.running = false;
    }
  }

  /** Exposed for unit tests */
  async publishPending(): Promise<number> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });

    let published = 0;
    for (const row of rows) {
      try {
        const payload =
          typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)
            ? (row.payload as Record<string, unknown>)
            : {};

        await this.events.publish(row.routingKey, {
          type: row.type,
          producer: 'appointment-service',
          payload,
          eventId: row.eventId,
          correlationId: row.correlationId ?? undefined,
        });

        await this.prisma.outboxEvent.update({
          where: { id: row.id },
          data: {
            status: OutboxStatus.PUBLISHED,
            publishedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        published += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const nextAttempts = row.attempts + 1;
        const failed = nextAttempts >= this.maxAttempts;
        await this.prisma.outboxEvent.update({
          where: { id: row.id },
          data: {
            attempts: nextAttempts,
            lastError: message.slice(0, 2000),
            status: failed ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          },
        });
        this.logger.error({
          message: 'outbox publish failed',
          eventId: row.eventId,
          attempts: nextAttempts,
          failed,
          error: message,
        });
      }
    }

    if (published > 0) {
      this.logger.log({ message: 'outbox published', count: published });
    }
    return published;
  }
}
