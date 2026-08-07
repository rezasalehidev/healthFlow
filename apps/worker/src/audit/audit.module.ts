import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingModule } from '@healthflow/messaging';
import { RemindersModule } from '../reminders/reminders.module';
import { AuditLog, AuditLogSchema } from './audit-log.schema';
import { AuditLogService } from './audit-log.service';
import { AuditConsumer } from './audit.consumer';

@Module({
  imports: [
    MessagingModule,
    RemindersModule,
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  providers: [AuditLogService, AuditConsumer],
  exports: [AuditLogService],
})
export class AuditModule {}
