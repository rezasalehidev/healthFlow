import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { EXCHANGES, RabbitMqService, type DomainEventEnvelope } from '@healthflow/messaging';
import { AppointmentsRealtimeGateway } from './appointments.gateway';

/**
 * Bridges RabbitMQ appointment.* events → WebSocket clients.
 */
@Injectable()
export class AppointmentEventsBridge implements OnModuleInit {
  private readonly logger = new Logger(AppointmentEventsBridge.name);
  private static readonly QUEUE = 'healthflow.gateway.appointments.ws';

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly gateway: AppointmentsRealtimeGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const channel = await this.rabbit.getChannel();
      await channel.assertQueue(AppointmentEventsBridge.QUEUE, { durable: true });
      await channel.bindQueue(AppointmentEventsBridge.QUEUE, EXCHANGES.events, 'appointment.*');

      await channel.consume(AppointmentEventsBridge.QUEUE, (msg) => {
        void this.onMessage(msg);
      });

      this.logger.log('WebSocket event bridge consuming appointment.*');
    } catch (error: unknown) {
      this.logger.error({
        message: 'WebSocket bridge failed to start (RabbitMQ unavailable?)',
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
      this.gateway.broadcastAppointmentUpdate({
        type: envelope.type,
        occurredAt: envelope.occurredAt,
        ...envelope.payload,
      });
      channel.ack(msg);
    } catch (error: unknown) {
      this.logger.error({
        message: 'failed to bridge appointment event',
        error: error instanceof Error ? error.message : error,
      });
      channel.nack(msg, false, false);
    }
  }
}
