import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MessagingModule } from '@healthflow/messaging';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { ClinicalEventPublisher } from '../events/clinical-event.publisher';
import { ClinicalOutboxRelayService } from '../events/clinical-outbox-relay.service';
import { MedicalRecordsController } from '../medical-records/medical-records.controller';
import { MedicalRecordsService } from '../medical-records/medical-records.service';
import { PrescriptionsController } from '../prescriptions/prescriptions.controller';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    PrismaModule,
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
  controllers: [PatientsController, MedicalRecordsController, PrescriptionsController],
  providers: [
    PatientsService,
    MedicalRecordsService,
    PrescriptionsService,
    ClinicalEventPublisher,
    ClinicalOutboxRelayService,
    JwtStrategy,
    RolesGuard,
  ],
})
export class PatientsModule {}
