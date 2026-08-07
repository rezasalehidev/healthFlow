import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReminderJobDocument = HydratedDocument<ReminderJob>;

export type ReminderStatus = 'pending' | 'sent' | 'cancelled';

@Schema({ collection: 'reminder_jobs', timestamps: true })
export class ReminderJob {
  @Prop({ required: true, index: true })
  appointmentId!: string;

  @Prop({ required: true })
  patientId!: string;

  @Prop({ required: true })
  doctorId!: string;

  @Prop({ required: true })
  startsAt!: Date;

  /** When this reminder should fire */
  @Prop({ required: true, index: true })
  remindAt!: Date;

  /** e.g. 24h | 1h */
  @Prop({ required: true })
  offsetLabel!: string;

  @Prop({ required: true, default: 'pending', index: true })
  status!: ReminderStatus;

  @Prop()
  sentAt?: Date;

  @Prop()
  publishedEventId?: string;
}

export const ReminderJobSchema = SchemaFactory.createForClass(ReminderJob);

ReminderJobSchema.index({ appointmentId: 1, offsetLabel: 1 }, { unique: true });
