import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { DomainEventEnvelope } from '@healthflow/messaging';
import { AuditLog, type AuditLogDocument } from './audit-log.schema';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>) {}

  async record(envelope: DomainEventEnvelope): Promise<{ inserted: boolean }> {
    try {
      await this.model.create({
        eventId: envelope.eventId,
        type: envelope.type,
        occurredAt: new Date(envelope.occurredAt),
        correlationId: envelope.correlationId,
        producer: envelope.producer,
        payload: envelope.payload,
        sourceQueue: 'healthflow.audit',
      });
      return { inserted: true };
    } catch (error: unknown) {
      // Duplicate eventId (idempotent redelivery)
      if (this.isDuplicateKey(error)) {
        this.logger.warn({ message: 'audit duplicate skipped', eventId: envelope.eventId });
        return { inserted: false };
      }
      throw error;
    }
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }
}
