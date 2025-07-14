import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { MessageEvent } from 'src/shared/interfaces';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;
  private readonly tasksQueuePrefix = 'tasks_queue:';
  private isConnected = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const rabbitmqUrl = process.env.JARVIS_KIT_RABBITMQ_URI;
      this.logger.log('Connecting to RabbitMQ...');
      
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      this.isConnected = true;
      this.logger.log('Connected to RabbitMQ successfully');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error.message);
      this.isConnected = false;
    }
  }

  private async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      this.logger.log('Disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  async publishThreadEvent(event: MessageEvent): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Unable to connect to RabbitMQ');
      }

      const messageBuffer = Buffer.from(JSON.stringify(event));
      const queueName = `${this.tasksQueuePrefix}${event.namespace}`;
      await this.channel.assertQueue(queueName, { durable: true });

      const sent = this.channel.sendToQueue(
        queueName,
        messageBuffer,
        {
          persistent: true,
          timestamp: Date.now(),
        }
      );

      if (sent) {
        this.logger.log(`Published thread event for thread ${event.message.thread}`);
      } else {
        throw new Error('Failed to send message to queue');
      }
    } catch (error) {
      this.logger.error('Failed to publish thread event:', error);
    }
  }
} 