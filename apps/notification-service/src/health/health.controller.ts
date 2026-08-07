import { Controller, Get } from '@nestjs/common';
import { successResponse } from '@healthflow/common';
import { EmailNotificationSimulator } from '../notifications/email-notification.simulator';

@Controller()
export class HealthController {
  constructor(private readonly email: EmailNotificationSimulator) {}

  @Get('health')
  health() {
    return successResponse({
      status: 'ok',
      service: 'notification-service',
      emailsSimulated: this.email.sent.length,
    });
  }

  @Get('health/live')
  live() {
    return successResponse({ status: 'alive' });
  }
}
