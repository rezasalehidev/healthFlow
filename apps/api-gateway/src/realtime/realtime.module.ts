import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MessagingModule } from '@healthflow/messaging';
import { AppointmentEventsBridge } from './appointment-events.bridge';
import { AppointmentsRealtimeGateway } from './appointments.gateway';

@Module({
  imports: [
    MessagingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [AppointmentsRealtimeGateway, AppointmentEventsBridge],
  exports: [AppointmentsRealtimeGateway],
})
export class RealtimeModule {}
