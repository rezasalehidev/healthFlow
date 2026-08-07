import { Global, Module } from '@nestjs/common';
import { EventPublisher } from './event.publisher';
import { RabbitMqService } from './rabbitmq.service';

@Global()
@Module({
  providers: [RabbitMqService, EventPublisher],
  exports: [RabbitMqService, EventPublisher],
})
export class MessagingModule {}
