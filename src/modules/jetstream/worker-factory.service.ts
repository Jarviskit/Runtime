import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JetStreamService } from './jetstream.service';
import { RedisLockService } from './redis-lock.service';
import { ThreadWorkerService } from './thread-worker.service';
import { ThreadEvent, ThreadEventType } from './interfaces/thread-event.interface';
import { JsMsg } from 'nats';
import { v4 as uuidv4 } from 'uuid';

interface ActiveWorker {
  runId: string;
  threadId: string;
  instanceId: string;
  startSequence: number;
  workerService: ThreadWorkerService;
  consumerName: string;
}

@Injectable()
export class WorkerFactory implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerFactory.name);
  private readonly instanceId: string;
  private activeWorkers = new Map<string, ActiveWorker>();
  private isRunning = false;
  private mainConsumerName: string;

  constructor(
    private readonly jetStreamService: JetStreamService,
    private readonly redisLockService: RedisLockService,
  ) {
    this.instanceId = process.env.INSTANCE_ID || `instance-${uuidv4()}`;
    this.mainConsumerName = `worker-factory-${this.instanceId}`;
  }

  async onModuleInit() {
    try {
      await this.startListening();
      this.logger.log(`WorkerFactory initialized with instance ID: ${this.instanceId}`);
    } catch (error) {
      this.logger.error('Failed to initialize WorkerFactory', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.isRunning = false;
    
    // Stop all active workers
    await this.stopAllWorkers();
    
    // Delete the main consumer
    await this.jetStreamService.deleteConsumer(this.mainConsumerName);
    
    this.logger.log('WorkerFactory destroyed');
  }

  private async startListening() {
    this.isRunning = true;
    
    // Create a consumer to listen for all thread events
    await this.jetStreamService.createConsumer(
      '*', // Listen to all threads
      this.mainConsumerName
    );

    // Start consuming messages
    this.consumeMessages();
  }

  private async consumeMessages() {
    try {
      await this.jetStreamService.subscribe(
        this.mainConsumerName,
        this.handleMessage.bind(this)
      );
    } catch (error) {
      this.logger.error('Error in message consumption', error);
      
      // Retry after a delay if still running
      if (this.isRunning) {
        setTimeout(() => this.consumeMessages(), 5000);
      }
    }
  }

  private async handleMessage(event: ThreadEvent, msg: JsMsg): Promise<void> {
    try {
      this.logger.debug(`Received event: ${event.type} for thread ${event.threadId}, run ${event.runId}`);

      switch (event.type) {
        case ThreadEventType.RUN_STARTED:
          await this.handleRunStarted(event, msg);
          break;
        
        case ThreadEventType.RUN_COMPLETED:
        case ThreadEventType.RUN_FAILED:
        case ThreadEventType.RUN_CANCELLED:
          await this.handleRunEnded(event);
          break;
        
        default:
          // For other events, we don't need to take action at the factory level
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling message for event ${event.type}`, error);
      throw error;
    }
  }

  private async handleRunStarted(event: ThreadEvent, msg: JsMsg): Promise<void> {
    const { runId, threadId } = event;
    
    // Check if we already have a worker for this run
    if (this.activeWorkers.has(runId)) {
      this.logger.warn(`Worker already exists for run ${runId}`);
      return;
    }

    // Try to acquire the lock for this run
    const lockAcquired = await this.redisLockService.acquireLock(runId, this.instanceId);
    
    if (!lockAcquired) {
      this.logger.debug(`Failed to acquire lock for run ${runId} - another instance is handling it`);
      return;
    }

    try {
      // Create a dedicated consumer for this thread starting from the RUN_STARTED event
      const workerConsumerName = `thread-worker-${runId}-${this.instanceId}`;
      await this.jetStreamService.createConsumer(
        threadId,
        workerConsumerName,
        msg.seq // Start from the sequence of the RUN_STARTED event
      );

      // Create and start the thread worker
      const workerService = new ThreadWorkerService(
        this.jetStreamService,
        this.redisLockService,
        runId,
        threadId,
        this.instanceId,
        workerConsumerName
      );

      // Store the active worker
      this.activeWorkers.set(runId, {
        runId,
        threadId,
        instanceId: this.instanceId,
        startSequence: msg.seq,
        workerService,
        consumerName: workerConsumerName,
      });

      // Start the worker
      await workerService.start();

      this.logger.log(`Started thread worker for run ${runId} on thread ${threadId}`);
    } catch (error) {
      this.logger.error(`Failed to start worker for run ${runId}`, error);
      
      // Release the lock if we failed to start the worker
      await this.redisLockService.releaseLock(runId, this.instanceId);
      throw error;
    }
  }

  private async handleRunEnded(event: ThreadEvent): Promise<void> {
    const { runId } = event;
    
    const worker = this.activeWorkers.get(runId);
    if (!worker) {
      this.logger.debug(`No active worker found for ended run ${runId}`);
      return;
    }

    // Only handle if this instance owns the worker
    if (worker.instanceId !== this.instanceId) {
      return;
    }

    try {
      // Stop the worker
      await worker.workerService.stop();
      
      // Delete the consumer
      await this.jetStreamService.deleteConsumer(worker.consumerName);
      
      // Release the lock
      await this.redisLockService.releaseLock(runId, this.instanceId);
      
      // Remove from active workers
      this.activeWorkers.delete(runId);
      
      this.logger.log(`Stopped and cleaned up worker for run ${runId}`);
    } catch (error) {
      this.logger.error(`Error stopping worker for run ${runId}`, error);
    }
  }

  private async stopAllWorkers(): Promise<void> {
    const workers = Array.from(this.activeWorkers.values());
    
    for (const worker of workers) {
      try {
        await worker.workerService.stop();
        await this.jetStreamService.deleteConsumer(worker.consumerName);
        await this.redisLockService.releaseLock(worker.runId, this.instanceId);
      } catch (error) {
        this.logger.error(`Error stopping worker for run ${worker.runId}`, error);
      }
    }
    
    this.activeWorkers.clear();
    this.logger.log('All workers stopped');
  }

  /**
   * Get information about active workers (for monitoring/debugging)
   */
  getActiveWorkers(): {runId: string, threadId: string, startSequence: number}[] {
    return Array.from(this.activeWorkers.values()).map(worker => ({
      runId: worker.runId,
      threadId: worker.threadId,
      startSequence: worker.startSequence,
    }));
  }

  /**
   * Force stop a specific worker (for debugging/admin purposes)
   */
  async forceStopWorker(runId: string): Promise<boolean> {
    const worker = this.activeWorkers.get(runId);
    if (!worker) {
      return false;
    }

    try {
      await worker.workerService.stop();
      await this.jetStreamService.deleteConsumer(worker.consumerName);
      await this.redisLockService.releaseLock(runId, this.instanceId);
      this.activeWorkers.delete(runId);
      
      this.logger.log(`Force stopped worker for run ${runId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error force stopping worker for run ${runId}`, error);
      return false;
    }
  }

  /**
   * Get instance information
   */
  getInstanceInfo(): {instanceId: string, activeWorkerCount: number} {
    return {
      instanceId: this.instanceId,
      activeWorkerCount: this.activeWorkers.size,
    };
  }
}