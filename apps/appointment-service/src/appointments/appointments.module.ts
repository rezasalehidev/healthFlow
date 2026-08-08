import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MessagingModule } from '@healthflow/messaging';
import { RedisModule } from '@healthflow/redis';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { DoctorAvailabilityClientService } from '../doctors/doctor-availability.client';
import { AppointmentEventPublisher } from '../events/appointment-event.publisher';
import { OutboxRelayService } from '../events/outbox-relay.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MessagingModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    DoctorAvailabilityClientService,
    AppointmentEventPublisher,
    OutboxRelayService,
    JwtStrategy,
    RolesGuard,
  ],
})
export class AppointmentsModule {}
