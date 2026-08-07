import { Module } from '@nestjs/common';
import { MessagingModule } from '@healthflow/messaging';
import { EmailNotificationSimulator } from './email-notification.simulator';
import { NotificationConsumer } from './notification.consumer';

@Module({
  imports: [MessagingModule],
  providers: [EmailNotificationSimulator, NotificationConsumer],
  exports: [EmailNotificationSimulator],
})
export class NotificationsModule {}
