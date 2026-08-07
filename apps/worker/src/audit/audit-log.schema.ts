import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string;

  @Prop({ required: true, index: true })
  type!: string;

  @Prop({ required: true })
  occurredAt!: Date;

  @Prop()
  correlationId?: string;

  @Prop({ required: true })
  producer!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true, default: 'healthflow.audit' })
  sourceQueue!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
