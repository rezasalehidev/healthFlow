import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingModule } from '@healthflow/messaging';
import { ReminderJob, ReminderJobSchema } from './reminder-job.schema';
import { ReminderPlannerService } from './reminder-planner.service';
import { ReminderDispatcherService } from './reminder-dispatcher.service';

@Module({
  imports: [
    MessagingModule,
    MongooseModule.forFeature([{ name: ReminderJob.name, schema: ReminderJobSchema }]),
  ],
  providers: [ReminderPlannerService, ReminderDispatcherService],
  exports: [ReminderPlannerService, ReminderDispatcherService],
})
export class RemindersModule {}
