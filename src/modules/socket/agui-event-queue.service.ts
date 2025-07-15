import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { AGUIEvent } from './interfaces';
import { Server } from 'socket.io';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ThreadService } from '../thread/thread.service';
import { AGUIEventMonitorService } from './agui-event-monitor.service';

interface QueuedAGUIEvent {
  event: AGUIEvent;
  server: Server;
  timestamp: number;
}

@Injectable()
export class AGUIEventQueueService implements OnModuleInit {
  private readonly logger = new Logger(AGUIEventQueueService.name);
  private readonly processingThreads = new Set<string>();
  private readonly queueName = 'agui_events_queue';
  
  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly threadService: ThreadService,
    private readonly monitorService: AGUIEventMonitorService,
  ) {}

  async onModuleInit() {
    // Start consuming events from RabbitMQ
    await this.startConsumer();
  }

  /**
   * Queue AGUI event for sequential processing
   */
  async queueAGUIEvent(event: AGUIEvent, server: Server): Promise<void> {
    try {
      const queuedEvent: QueuedAGUIEvent = {
        event,
        server: null, // Server instance cannot be serialized
        timestamp: Date.now(),
      };

      // Store server instance in memory mapped by thread ID
      await this.storeServerInstance(event.threadId, server);

      // Publish event to RabbitMQ with thread-specific routing key
      await this.rabbitmqService.publishAGUIEvent(queuedEvent, event.threadId);
      
      this.logger.log(`Queued AGUI event for thread ${event.threadId}, session ${event.sessionId}, order ${event.order}`);
    } catch (error) {
      this.logger.error(`Failed to queue AGUI event: ${error.message}`);
      await this.monitorService.recordError(event.threadId, error);
      throw error;
    }
  }

  /**
   * Start consuming events from RabbitMQ
   */
  private async startConsumer(): Promise<void> {
    try {
      await this.rabbitmqService.consumeAGUIEvents(
        this.queueName,
        this.processAGUIEvent.bind(this)
      );
      this.logger.log('Started AGUI event consumer');
    } catch (error) {
      this.logger.error(`Failed to start AGUI event consumer: ${error.message}`);
    }
  }

  /**
   * Process AGUI event sequentially per thread
   */
  private async processAGUIEvent(queuedEvent: QueuedAGUIEvent): Promise<void> {
    const { event, timestamp } = queuedEvent;
    const { threadId, sessionId, order } = event;
    const processingStartTime = Date.now();

    // Ensure only one event per thread is processed at a time
    if (this.processingThreads.has(threadId)) {
      this.logger.warn(`Thread ${threadId} is already being processed, requeueing event`);
      // Requeue the event with delay
      await this.requeueEvent(queuedEvent);
      return;
    }

    this.processingThreads.add(threadId);
    
    // Track active thread
    await this.markThreadAsActive(threadId);
    
    try {
      // Check if this event should be processed based on order
      const shouldProcess = await this.shouldProcessEvent(event);
      
      if (!shouldProcess) {
        this.logger.warn(`Event order ${order} for thread ${threadId} is out of sequence, requeueing`);
        await this.requeueEvent(queuedEvent);
        return;
      }

      // Retrieve server instance
      const server = await this.getServerInstance(threadId);
      if (!server) {
        this.logger.error(`Server instance not found for thread ${threadId}`);
        return;
      }

      // Process the event
      await this.handleAGUIEvent(event, server);
      
      // Mark event as processed
      await this.markEventAsProcessed(event);
      
      // Record successful processing
      const processingTime = Date.now() - processingStartTime;
      await this.monitorService.recordProcessingTime(threadId, processingTime);
      await this.monitorService.recordSuccess(threadId);
      
      this.logger.log(`Processed AGUI event for thread ${threadId}, session ${sessionId}, order ${order} in ${processingTime}ms`);
    } catch (error) {
      this.logger.error(`Error processing AGUI event for thread ${threadId}: ${error.message}`);
      
      // Record error
      await this.monitorService.recordError(threadId, error);
      
      // Handle error by requeueing or sending to dead letter queue
      await this.handleProcessingError(queuedEvent, error);
    } finally {
      this.processingThreads.delete(threadId);
      await this.markThreadAsInactive(threadId);
    }
  }

  /**
   * Check if event should be processed based on order
   */
  private async shouldProcessEvent(event: AGUIEvent): Promise<boolean> {
    const redis = this.redisService.getOrThrow();
    const key = `thread:${event.threadId}:last_processed_order`;
    
    const lastProcessedOrder = await redis.get(key);
    const lastOrder = lastProcessedOrder ? parseInt(lastProcessedOrder) : -1;
    
    // Event should be processed if its order is the next expected order
    return event.order === lastOrder + 1;
  }

  /**
   * Mark event as processed and update last processed order
   */
  private async markEventAsProcessed(event: AGUIEvent): Promise<void> {
    const redis = this.redisService.getOrThrow();
    const key = `thread:${event.threadId}:last_processed_order`;
    
    await redis.set(key, event.order.toString(), 'EX', 60 * 60 * 24); // 24 hours TTL
  }

  /**
   * Mark thread as active
   */
  private async markThreadAsActive(threadId: string): Promise<void> {
    const redis = this.redisService.getOrThrow();
    await redis.sadd('agui_events:active_threads', threadId);
  }

  /**
   * Mark thread as inactive
   */
  private async markThreadAsInactive(threadId: string): Promise<void> {
    const redis = this.redisService.getOrThrow();
    await redis.srem('agui_events:active_threads', threadId);
  }

  /**
   * Store server instance in Redis for thread
   */
  private async storeServerInstance(threadId: string, server: Server): Promise<void> {
    // Store server instance in memory (cannot serialize Socket.IO server)
    // Use a simple in-memory map for now
    this.serverInstances.set(threadId, server);
  }

  private readonly serverInstances = new Map<string, Server>();

  /**
   * Get server instance for thread
   */
  private async getServerInstance(threadId: string): Promise<Server | null> {
    return this.serverInstances.get(threadId) || null;
  }

  /**
   * Requeue event with delay
   */
  private async requeueEvent(queuedEvent: QueuedAGUIEvent): Promise<void> {
    const { event } = queuedEvent;
    
    // Add delay to prevent infinite fast requeueing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await this.rabbitmqService.publishAGUIEvent(queuedEvent, event.threadId);
  }

  /**
   * Handle processing errors
   */
  private async handleProcessingError(queuedEvent: QueuedAGUIEvent, error: Error): Promise<void> {
    // For now, just log the error
    // In production, you might want to send to dead letter queue after max retries
    this.logger.error(`Failed to process AGUI event: ${error.message}`);
  }

  /**
   * Process the actual AGUI event (extracted from original SocketService)
   */
  private async handleAGUIEvent(payload: AGUIEvent, server: Server): Promise<void> {
    console.log(`[${payload.threadId} - ${payload.sessionId} - ${payload.event.messageId} -> ${payload.event.type}] ${payload.event.delta || ''}`);
    const event = { order: payload.order, ...payload.event };

    try {
      const redis = this.redisService.getOrThrow();
      await redis.lpush(`thread:${payload.threadId}:${payload.sessionId}`, JSON.stringify(event));
      await redis.expire(`thread:${payload.threadId}:${payload.sessionId}`, 60 * 30);

      // Emit event to thread service for processing
      this.eventEmitter.emit('agui.event.process', payload);

      // Emit to connected clients
      server.to(`thread:${payload.threadId}`).emit('agui_event', event);
      
    } catch (error) {
      this.logger.error(`Error handling AGUI event: ${error.stack}`);
      throw error;
    }
  }
}