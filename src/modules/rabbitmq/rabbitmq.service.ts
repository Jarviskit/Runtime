import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { MessageEvent } from 'src/shared/interfaces';

interface QueuedAGUIEvent {
  event: any;
  server: any;
  timestamp: number;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;
  private readonly tasksQueuePrefix = 'tasks_queue:';
  private readonly aguiEventsExchange = 'agui_events';
  private readonly aguiEventsQueuePrefix = 'agui_events_queue:';
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

      // Setup exchange for AGUI events
      await this.channel.assertExchange(this.aguiEventsExchange, 'topic', { durable: true });

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

  /**
   * Publish AGUI event to RabbitMQ with thread-specific routing
   */
  async publishAGUIEvent(queuedEvent: QueuedAGUIEvent, threadId: string): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Unable to connect to RabbitMQ');
      }

      const messageBuffer = Buffer.from(JSON.stringify(queuedEvent));
      const routingKey = `thread.${threadId}`;

      // Publish to exchange with thread-specific routing key
      const sent = this.channel.publish(
        this.aguiEventsExchange,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          timestamp: Date.now(),
          headers: {
            threadId,
            eventType: queuedEvent.event.event.type,
            order: queuedEvent.event.order,
          },
        }
      );

      if (sent) {
        this.logger.log(`Published AGUI event for thread ${threadId}, order ${queuedEvent.event.order}`);
      } else {
        throw new Error('Failed to send AGUI event to exchange');
      }
    } catch (error) {
      this.logger.error('Failed to publish AGUI event:', error);
      throw error;
    }
  }

  /**
   * Consume AGUI events from RabbitMQ
   */
  async consumeAGUIEvents(
    queueName: string,
    processor: (queuedEvent: QueuedAGUIEvent) => Promise<void>
  ): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Unable to connect to RabbitMQ');
      }

      // Create queue bound to exchange with wildcard routing key
      await this.channel.assertQueue(queueName, { 
        durable: true,
        arguments: {
          'x-message-ttl': 60000, // 1 minute TTL
          'x-max-retries': 3,
        }
      });

      // Bind queue to exchange with pattern to match all thread events
      await this.channel.bindQueue(queueName, this.aguiEventsExchange, 'thread.*');

      // Set prefetch to 1 to ensure sequential processing per consumer
      await this.channel.prefetch(1);

      // Start consuming messages
      await this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const queuedEvent: QueuedAGUIEvent = JSON.parse(msg.content.toString());
            
            // Process the event
            await processor(queuedEvent);
            
            // Acknowledge message after successful processing
            this.channel.ack(msg);
            
            this.logger.log(`Successfully processed AGUI event for thread ${queuedEvent.event.threadId}`);
          } catch (error) {
            this.logger.error(`Error processing AGUI event: ${error.message}`);
            
            // Reject message and requeue for retry
            this.channel.nack(msg, false, true);
          }
        }
      }, {
        noAck: false, // Enable manual acknowledgment
      });

      this.logger.log(`Started consuming AGUI events from queue: ${queueName}`);
    } catch (error) {
      this.logger.error('Failed to start AGUI event consumer:', error);
      throw error;
    }
  }

  /**
   * Create thread-specific queue for AGUI events
   */
  async createThreadQueue(threadId: string): Promise<string> {
    try {
      if (!this.isConnected) {
        throw new Error('Unable to connect to RabbitMQ');
      }

      const queueName = `${this.aguiEventsQueuePrefix}${threadId}`;
      
      await this.channel.assertQueue(queueName, { 
        durable: true,
        arguments: {
          'x-message-ttl': 300000, // 5 minutes TTL
          'x-max-length': 1000, // Maximum queue length
        }
      });

      // Bind queue to exchange with thread-specific routing key
      await this.channel.bindQueue(queueName, this.aguiEventsExchange, `thread.${threadId}`);

      this.logger.log(`Created thread-specific queue: ${queueName}`);
      return queueName;
    } catch (error) {
      this.logger.error(`Failed to create thread queue for ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * Delete thread-specific queue
   */
  async deleteThreadQueue(threadId: string): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Unable to connect to RabbitMQ');
      }

      const queueName = `${this.aguiEventsQueuePrefix}${threadId}`;
      await this.channel.deleteQueue(queueName);

      this.logger.log(`Deleted thread-specific queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to delete thread queue for ${threadId}:`, error);
    }
  }

  /**
   * Get queue stats for monitoring
   */
  async getQueueStats(queueName: string): Promise<{ messageCount: number; consumerCount: number }> {
    try {
      if (!this.isConnected) {
        throw new Error('Unable to connect to RabbitMQ');
      }

      const queueInfo = await this.channel.checkQueue(queueName);
      return {
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats for ${queueName}:`, error);
      return { messageCount: 0, consumerCount: 0 };
    }
  }
} 