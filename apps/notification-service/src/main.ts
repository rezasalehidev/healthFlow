import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilter, LoggingInterceptor } from '@healthflow/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = Number(process.env.PORT ?? process.env.NOTIFICATION_SERVICE_PORT ?? 3005);
  await app.listen(port);
  Logger.log(`notification-service listening on :${port}`, 'Bootstrap');
}

void bootstrap();
