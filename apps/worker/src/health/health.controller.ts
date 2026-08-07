import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { successResponse } from '@healthflow/common';
import { Connection, ConnectionStates } from 'mongoose';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private readonly mongo: Connection) {}

  @Get('health')
  health() {
    return successResponse({
      status: 'ok',
      service: 'worker',
      mongo: this.mongo.readyState === ConnectionStates.connected ? 'connected' : 'disconnected',
    });
  }

  @Get('health/live')
  live() {
    return successResponse({ status: 'alive' });
  }
}
