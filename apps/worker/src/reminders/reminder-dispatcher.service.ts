import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { EventPublisher, ROUTING_KEYS } from '@healthflow/messaging';
import { ReminderJob, type ReminderJobDocument } from './reminder-job.schema';

/**
 * Polls Mongo for due reminder jobs and publishes appointment.reminder events.
 */
@Injectable()
export class ReminderDispatcherService {
  private readonly logger = new Logger(ReminderDispatcherService.name);
  private running = false;

  constructor(
    @InjectModel(ReminderJob.name) private readonly model: Model<ReminderJobDocument>,
    private readonly publisher: EventPublisher,
  ) {}

  @Interval(30_000)
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.dispatchDue();
    } catch (error: unknown) {
      this.logger.error({
        message: 'reminder dispatch failed',
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      this.running = false;
    }
  }

  /** Exposed for unit tests */
  async dispatchDue(now = new Date()): Promise<number> {
    const due = await this.model
      .find({ status: 'pending', remindAt: { $lte: now } })
      .limit(50)
      .exec();

    let sent = 0;
    for (const job of due) {
      const envelope = await this.publisher.publish(ROUTING_KEYS.appointmentReminder, {
        type: ROUTING_KEYS.appointmentReminder,
        producer: 'worker',
        payload: {
          appointmentId: job.appointmentId,
          patientId: job.patientId,
          doctorId: job.doctorId,
          startsAt: job.startsAt.toISOString(),
          offsetLabel: job.offsetLabel,
          remindAt: job.remindAt.toISOString(),
        },
      });

      job.status = 'sent';
      job.sentAt = new Date();
      job.publishedEventId = envelope.eventId;
      await job.save();
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log({ message: 'reminders dispatched', count: sent });
    }
    return sent;
  }
}
