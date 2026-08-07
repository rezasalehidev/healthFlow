import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { DomainEventEnvelope } from '@healthflow/messaging';
import { ReminderJob, type ReminderJobDocument } from './reminder-job.schema';

const PLAN_TYPES = new Set([
  'appointment.created',
  'appointment.confirmed',
  'appointment.rescheduled',
]);

const CANCEL_TYPES = new Set([
  'appointment.cancelled',
  'appointment.completed',
  'appointment.no_show',
]);

@Injectable()
export class ReminderPlannerService {
  private readonly logger = new Logger(ReminderPlannerService.name);
  private readonly offsetsHours: number[];

  constructor(
    @InjectModel(ReminderJob.name) private readonly model: Model<ReminderJobDocument>,
    config: ConfigService,
  ) {
    const raw = config.get<string>('REMINDER_OFFSETS_HOURS', '24,1');
    this.offsetsHours = raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async handleDomainEvent(envelope: DomainEventEnvelope): Promise<void> {
    if (CANCEL_TYPES.has(envelope.type)) {
      await this.cancelForAppointment(envelope);
      return;
    }
    if (PLAN_TYPES.has(envelope.type)) {
      await this.planForAppointment(envelope);
    }
  }

  private async planForAppointment(envelope: DomainEventEnvelope): Promise<void> {
    const appointmentId = asString(envelope.payload.appointmentId);
    const patientId = asString(envelope.payload.patientId);
    const doctorId = asString(envelope.payload.doctorId);
    const startsAtRaw = asString(envelope.payload.startsAt) ?? asString(envelope.payload.starts_at);

    if (!appointmentId || !patientId || !doctorId || !startsAtRaw) {
      this.logger.warn({
        message: 'skip reminder plan — missing payload fields',
        type: envelope.type,
        eventId: envelope.eventId,
      });
      return;
    }

    const startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) {
      this.logger.warn({ message: 'skip reminder plan — invalid startsAt', startsAtRaw });
      return;
    }

    // Reschedule: drop old pending jobs then recreate
    if (envelope.type === 'appointment.rescheduled') {
      await this.model.updateMany(
        { appointmentId, status: 'pending' },
        { $set: { status: 'cancelled' } },
      );
    }

    const now = Date.now();
    for (const hours of this.offsetsHours) {
      const remindAt = new Date(startsAt.getTime() - hours * 60 * 60 * 1000);
      const offsetLabel = `${hours}h`;
      if (remindAt.getTime() <= now) {
        continue;
      }

      await this.model.findOneAndUpdate(
        { appointmentId, offsetLabel },
        {
          $set: {
            patientId,
            doctorId,
            startsAt,
            remindAt,
            status: 'pending',
            sentAt: null,
            publishedEventId: null,
          },
          $setOnInsert: { appointmentId, offsetLabel },
        },
        { upsert: true, new: true },
      );
    }

    this.logger.log({
      message: 'reminders planned',
      appointmentId,
      offsets: this.offsetsHours,
    });
  }

  private async cancelForAppointment(envelope: DomainEventEnvelope): Promise<void> {
    const appointmentId = asString(envelope.payload.appointmentId);
    if (!appointmentId) {
      return;
    }
    const result = await this.model.updateMany(
      { appointmentId, status: 'pending' },
      { $set: { status: 'cancelled' } },
    );
    this.logger.log({
      message: 'reminders cancelled',
      appointmentId,
      modified: result.modifiedCount,
    });
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
