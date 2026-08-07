import { Injectable, Logger } from '@nestjs/common';
import type { DomainEventEnvelope } from '@healthflow/messaging';

export interface NotificationResult {
  channel: 'email';
  template: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Simulates outbound email delivery for demo / interview purposes.
 */
@Injectable()
export class EmailNotificationSimulator {
  private readonly logger = new Logger(EmailNotificationSimulator.name);
  readonly sent: NotificationResult[] = [];

  async sendForEvent(event: DomainEventEnvelope): Promise<NotificationResult> {
    const appointmentId =
      typeof event.payload.appointmentId === 'string' ? event.payload.appointmentId : 'unknown';

    const result: NotificationResult = {
      channel: 'email',
      template: event.type,
      to: 'patient@example.com',
      subject: this.subjectFor(event.type),
      body: `HealthFlow notification for ${event.type} (appointment ${appointmentId})`,
    };

    // Simulated I/O
    await Promise.resolve();
    this.sent.push(result);
    this.logger.log({
      message: 'email simulated',
      template: result.template,
      to: result.to,
      eventId: event.eventId,
    });
    return result;
  }

  private subjectFor(type: string): string {
    switch (type) {
      case 'appointment.created':
        return 'Appointment request received';
      case 'appointment.confirmed':
        return 'Appointment confirmed';
      case 'appointment.cancelled':
        return 'Appointment cancelled';
      case 'appointment.rescheduled':
        return 'Appointment rescheduled';
      case 'appointment.reminder':
        return 'Appointment reminder';
      case 'prescription.created':
        return 'New prescription available';
      case 'medical-record.created':
      case 'medical-record.updated':
        return 'Medical record update';
      default:
        return 'HealthFlow notification';
    }
  }
}
