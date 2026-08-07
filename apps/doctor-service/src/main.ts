import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GlobalExceptionFilter, LoggingInterceptor } from '@healthflow/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const grpcUrl = config.get<string>('DOCTOR_GRPC_BIND', '0.0.0.0:50051');
  const protoPath = join(process.cwd(), 'proto/doctor/v1/availability.proto');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'healthflow.doctor.v1',
      protoPath,
      url: grpcUrl,
    },
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.startAllMicroservices();

  const port = Number(process.env.PORT ?? process.env.DOCTOR_SERVICE_PORT ?? 3003);
  await app.listen(port);
  Logger.log(`doctor-service HTTP :${port} | gRPC ${grpcUrl}`, 'Bootstrap');
}

void bootstrap();
