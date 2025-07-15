import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { ThreadModule } from '../thread/thread.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { AGUIEventQueueService } from './agui-event-queue.service';
import { AGUIEventMonitorService } from './agui-event-monitor.service';

@Module({
  imports: [
    ThreadModule, 
    RabbitMQModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    SocketGateway, 
    SocketService, 
    AGUIEventQueueService,
    AGUIEventMonitorService,
  ],
  exports: [
    SocketService, 
    AGUIEventQueueService,
    AGUIEventMonitorService,
  ],
})
export class SocketModule {}