import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { QUEUES, RabbitMqService, type DomainEventEnvelope } from '@healthflow/messaging';
import { AuditLogService } from './audit-log.service';
import { ReminderPlannerService } from '../reminders/reminder-planner.service';

/**
 * Consumes all domain events from healthflow.audit and:
 * 1) persists an immutable audit row in MongoDB
 * 2) plans / cancels appointment reminder jobs
 */
@Injectable()
export class AuditConsumer implements OnModuleInit {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly audit: AuditLogService,
    private readonly reminders: ReminderPlannerService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const channel = await this.rabbit.getChannel();
      await channel.prefetch(20);
      await channel.consume(QUEUES.audit, (msg) => {
        void this.onMessage(msg);
      });
      this.logger.log('Audit consumer started on healthflow.audit');
    } catch (error: unknown) {
      this.logger.error({
        message: 'Audit consumer failed to start',
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private async onMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      return;
    }
    const channel = await this.rabbit.getChannel();
    try {
      const envelope = JSON.parse(msg.content.toString('utf8')) as DomainEventEnvelope;
      await this.audit.record(envelope);
      await this.reminders.handleDomainEvent(envelope);
      channel.ack(msg);
    } catch (error: unknown) {
      this.logger.error({
        message: 'audit processing failed',
        error: error instanceof Error ? error.message : error,
      });
      // requeue once-ish; poison messages should go to a DLQ in production
      channel.nack(msg, false, false);
    }
  }
}
