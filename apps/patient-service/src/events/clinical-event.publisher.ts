import { Injectable, Logger } from '@nestjs/common';
import { EventPublisher, ROUTING_KEYS } from '@healthflow/messaging';

@Injectable()
export class ClinicalEventPublisher {
  private readonly logger = new Logger(ClinicalEventPublisher.name);
  readonly published: Array<{ type: string; payload: Record<string, unknown> }> = [];

  constructor(private readonly events: EventPublisher) {}

  async publish(
    type:
      | typeof ROUTING_KEYS.medicalRecordCreated
      | typeof ROUTING_KEYS.medicalRecordUpdated
      | typeof ROUTING_KEYS.prescriptionCreated,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.published.push({ type, payload });
    try {
      await this.events.publish(type, {
        type,
        producer: 'patient-service',
        payload,
      });
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to publish clinical event',
        type,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
