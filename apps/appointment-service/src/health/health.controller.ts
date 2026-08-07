import { Controller, Get } from '@nestjs/common';
import { successResponse } from '@healthflow/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return successResponse({ status: 'ok', service: 'appointment-service' });
  }

  @Get('health/live')
  live() {
    return successResponse({ status: 'alive' });
  }
}
