import { Logger } from '@nestjs/common';
import { JetStreamService } from './jetstream.service';
import { RedisLockService } from './redis-lock.service';
import { ThreadEvent, ThreadEventType } from './interfaces/thread-event.interface';
import { JsMsg } from 'nats';

export class ThreadWorkerService {
  private readonly logger = new Logger(ThreadWorkerService.name);
  private isRunning = false;
  private processingQueue: ThreadEvent[] = [];
  private isProcessing = false;

  constructor(
    private readonly jetStreamService: JetStreamService,
    private readonly redisLockService: RedisLockService,
    private readonly runId: string,
    private readonly threadId: string,
    private readonly instanceId: string,
    private readonly consumerName: string,
  ) {}

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.log(`Starting thread worker for run ${this.runId} on thread ${this.threadId}`);
    
    // Start consuming messages
    this.consumeMessages();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.log(`Stopping thread worker for run ${this.runId}`);
    
    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async consumeMessages(): Promise<void> {
    try {
      await this.jetStreamService.subscribe(
        this.consumerName,
        this.handleMessage.bind(this)
      );
    } catch (error) {
      this.logger.error(`Error in message consumption for run ${this.runId}`, error);
      
      // Retry after a delay if still running
      if (this.isRunning) {
        setTimeout(() => this.consumeMessages(), 5000);
      }
    }
  }

  private async handleMessage(event: ThreadEvent, msg: JsMsg): Promise<void> {
    try {
      // Verify we still hold the lock for this run
      const lockHeld = await this.redisLockService.isLockHeld(this.runId, this.instanceId);
      if (!lockHeld) {
        this.logger.warn(`Lock lost for run ${this.runId}, stopping worker`);
        this.isRunning = false;
        return;
      }

      this.logger.debug(`Received event: ${event.type} for run ${this.runId}, sequence: ${event.sequenceId}`);

      // Add to processing queue
      this.processingQueue.push(event);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        await this.processQueue();
      }
    } catch (error) {
      this.logger.error(`Error handling message for run ${this.runId}`, error);
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0 && this.isRunning) {
        const event = this.processingQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing queue for run ${this.runId}`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: ThreadEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing event ${event.type} for run ${this.runId} (sequence: ${event.sequenceId})`);
      
      switch (event.type) {
        case ThreadEventType.RUN_STARTED:
          await this.handleRunStarted(event);
          break;
        
        case ThreadEventType.RUN_PROGRESS:
          await this.handleRunProgress(event);
          break;
        
        case ThreadEventType.RUN_COMPLETED:
          await this.handleRunCompleted(event);
          break;
        
        case ThreadEventType.RUN_FAILED:
          await this.handleRunFailed(event);
          break;
        
        case ThreadEventType.RUN_CANCELLED:
          await this.handleRunCancelled(event);
          break;
        
        default:
          this.logger.warn(`Unknown event type: ${event.type}`);
      }
      
      const processingTime = Date.now() - startTime;
      this.logger.debug(`Processed event ${event.type} for run ${this.runId} in ${processingTime}ms`);
      
    } catch (error) {
      this.logger.error(`Error processing event ${event.type} for run ${this.runId}`, error);
      
      // Depending on your requirements, you might want to:
      // 1. Stop the worker on critical errors
      // 2. Continue processing other events
      // 3. Implement retry logic
      
      // For now, we'll log the error and continue
    }
  }

  private async handleRunStarted(event: ThreadEvent): Promise<void> {
    this.logger.log(`Run ${this.runId} started on thread ${this.threadId}`);
    
    // Here you can implement your business logic for when a run starts
    // For example:
    // - Initialize resources
    // - Set up monitoring
    // - Notify other systems
    
    // Example implementation:
    const payload = (event as any).payload;
    this.logger.log(`Run started with payload:`, payload);
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async handleRunProgress(event: ThreadEvent): Promise<void> {
    const payload = (event as any).payload;
    this.logger.log(`Run ${this.runId} progress: ${payload.progress}% - ${payload.message}`);
    
    // Here you can implement your business logic for progress updates
    // For example:
    // - Update progress in database
    // - Send notifications
    // - Update UI via WebSocket
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async handleRunCompleted(event: ThreadEvent): Promise<void> {
    const payload = (event as any).payload;
    this.logger.log(`Run ${this.runId} completed successfully in ${payload.executionTime}ms`);
    
    // Here you can implement your business logic for completion
    // For example:
    // - Save results to database
    // - Send completion notifications
    // - Clean up resources
    // - Update metrics
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mark this worker as ready to stop
    this.isRunning = false;
  }

  private async handleRunFailed(event: ThreadEvent): Promise<void> {
    const payload = (event as any).payload;
    this.logger.error(`Run ${this.runId} failed: ${payload.error}`);
    
    if (payload.stackTrace) {
      this.logger.error(`Stack trace: ${payload.stackTrace}`);
    }
    
    // Here you can implement your business logic for failures
    // For example:
    // - Log error details
    // - Send failure notifications
    // - Implement retry logic
    // - Clean up resources
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mark this worker as ready to stop
    this.isRunning = false;
  }

  private async handleRunCancelled(event: ThreadEvent): Promise<void> {
    const payload = (event as any).payload;
    this.logger.log(`Run ${this.runId} cancelled: ${payload.reason}`);
    
    // Here you can implement your business logic for cancellation
    // For example:
    // - Clean up resources
    // - Send cancellation notifications
    // - Update status
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mark this worker as ready to stop
    this.isRunning = false;
  }

  /**
   * Get worker status (for monitoring/debugging)
   */
  getStatus(): {
    runId: string;
    threadId: string;
    instanceId: string;
    isRunning: boolean;
    isProcessing: boolean;
    queueLength: number;
  } {
    return {
      runId: this.runId,
      threadId: this.threadId,
      instanceId: this.instanceId,
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
    };
  }

  /**
   * Force stop processing (for debugging/admin purposes)
   */
  forceStop(): void {
    this.isRunning = false;
    this.processingQueue = [];
    this.logger.warn(`Force stopped worker for run ${this.runId}`);
  }
}