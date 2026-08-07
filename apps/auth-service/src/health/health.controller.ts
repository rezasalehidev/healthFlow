import { Controller, Get } from '@nestjs/common';
import { successResponse } from '@healthflow/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return successResponse({ status: 'ok', service: 'auth-service' });
  }

  @Get('health/live')
  live() {
    return successResponse({ status: 'alive' });
  }

  @Get('health/ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return successResponse({ status: 'ready' });
  }
}
