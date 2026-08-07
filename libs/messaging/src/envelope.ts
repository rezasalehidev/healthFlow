import { randomUUID } from 'node:crypto';

export interface DomainEventEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  type: string;
  occurredAt: string;
  correlationId?: string;
  producer: string;
  payload: T;
}

export function createEnvelope<T extends Record<string, unknown>>(input: {
  type: string;
  producer: string;
  payload: T;
  eventId?: string;
  correlationId?: string;
  occurredAt?: string;
}): DomainEventEnvelope<T> {
  return {
    eventId: input.eventId ?? randomUUID(),
    type: input.type,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    producer: input.producer,
    payload: input.payload,
  };
}
