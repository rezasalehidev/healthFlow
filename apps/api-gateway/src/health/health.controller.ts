import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { successResponse } from '@healthflow/common';
import { Public } from '../auth/decorators/auth.decorators';
import { ProxyService } from '../proxy/proxy.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly proxy: ProxyService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Gateway liveness' })
  health() {
    return successResponse({ status: 'ok', service: 'api-gateway' });
  }

  @Public()
  @Get('health/live')
  live() {
    return successResponse({ status: 'alive' });
  }

  @Public()
  @Get('health/ready')
  async ready() {
    const authUrl = this.config.getOrThrow<string>('AUTH_SERVICE_URL');
    let authHealthy = false;
    try {
      const result = await this.proxy.forward({
        service: 'auth',
        method: 'GET',
        path: '/health',
      });
      authHealthy = result.status >= 200 && result.status < 300;
    } catch {
      authHealthy = false;
    }

    return successResponse({
      status: authHealthy ? 'ready' : 'degraded',
      dependencies: {
        authService: { url: authUrl, healthy: authHealthy },
      },
    });
  }
}
