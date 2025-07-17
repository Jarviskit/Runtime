import { JetStreamService } from '../jetstream.service';
import { ThreadEventType } from '../interfaces/thread-event.interface';

/**
 * Example usage of the JetStream Thread Event System
 * 
 * This example demonstrates how to publish events that will be processed
 * sequentially by the WorkerFactory system.
 */
export class JetStreamUsageExample {
  constructor(private readonly jetStreamService: JetStreamService) {}

  /**
   * Example: Start a new thread run
   */
  async startThreadRun() {
    const threadId = 'thread-001';
    const runId = 'run-12345';

    // 1. Publish RUN_STARTED event
    // This will trigger the WorkerFactory to create a lock and start a dedicated worker
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_STARTED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        userId: 'user-123',
        agentId: 'agent-456',
        inputData: {
          query: 'Hello, how are you?',
          context: 'casual conversation',
        },
      },
    });

    console.log(`Published RUN_STARTED event for thread ${threadId}, run ${runId}`);

    // 2. Simulate progress updates
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      await this.jetStreamService.publishThreadEvent(threadId, {
        type: ThreadEventType.RUN_PROGRESS,
        threadId,
        runId,
        timestamp: Date.now(),
        payload: {
          progress: i * 20,
          message: `Processing step ${i} of 5`,
          data: { step: i, details: `Step ${i} details` },
        },
      });

      console.log(`Published RUN_PROGRESS event: ${i * 20}%`);
    }

    // 3. Simulate completion
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_COMPLETED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        result: {
          response: 'Hello! I am doing well, thank you for asking.',
          confidence: 0.95,
          tokens_used: 150,
        },
        executionTime: 6000, // 6 seconds
      },
    });

    console.log(`Published RUN_COMPLETED event for run ${runId}`);
  }

  /**
   * Example: Simulate a failed run
   */
  async simulateFailedRun() {
    const threadId = 'thread-002';
    const runId = 'run-67890';

    // Start the run
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_STARTED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        userId: 'user-456',
        agentId: 'agent-789',
        inputData: {
          query: 'Complex query that will fail',
        },
      },
    });

    // Some progress
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_PROGRESS,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        progress: 30,
        message: 'Processing complex query...',
      },
    });

    // Simulate failure
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_FAILED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        error: 'Query processing failed: Invalid input format',
        stackTrace: 'Error: Invalid input format\n    at QueryProcessor.process(query.ts:45)\n    at Agent.run(agent.ts:123)',
      },
    });

    console.log(`Published RUN_FAILED event for run ${runId}`);
  }

  /**
   * Example: Simulate a cancelled run
   */
  async simulateCancelledRun() {
    const threadId = 'thread-003';
    const runId = 'run-11111';

    // Start the run
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_STARTED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        userId: 'user-789',
        agentId: 'agent-123',
        inputData: {
          query: 'Long running query',
        },
      },
    });

    // Some progress
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_PROGRESS,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        progress: 25,
        message: 'Processing long running query...',
      },
    });

    // User cancels
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_CANCELLED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        reason: 'User requested cancellation',
      },
    });

    console.log(`Published RUN_CANCELLED event for run ${runId}`);
  }

  /**
   * Example: Multiple concurrent runs on different threads
   */
  async simulateMultipleThreads() {
    const promises = [];

    // Start 3 concurrent runs on different threads
    for (let i = 1; i <= 3; i++) {
      promises.push(this.runConcurrentThread(i));
    }

    await Promise.all(promises);
    console.log('All concurrent threads completed');
  }

  private async runConcurrentThread(threadNumber: number) {
    const threadId = `thread-${threadNumber.toString().padStart(3, '0')}`;
    const runId = `run-concurrent-${threadNumber}`;

    // Start
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_STARTED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        userId: `user-${threadNumber}`,
        agentId: `agent-${threadNumber}`,
        inputData: { query: `Concurrent query ${threadNumber}` },
      },
    });

    // Progress
    for (let step = 1; step <= 3; step++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.jetStreamService.publishThreadEvent(threadId, {
        type: ThreadEventType.RUN_PROGRESS,
        threadId,
        runId,
        timestamp: Date.now(),
        payload: {
          progress: step * 33,
          message: `Thread ${threadNumber} - Step ${step}`,
        },
      });
    }

    // Complete
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_COMPLETED,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        result: `Result from thread ${threadNumber}`,
        executionTime: 2000,
      },
    });

    console.log(`Thread ${threadNumber} completed`);
  }
}

/**
 * HTTP API Usage Examples
 * 
 * You can also use the REST API endpoints to publish events:
 * 
 * 1. Start a run:
 * POST /jetstream/events/run-started
 * {
 *   "threadId": "thread-001",
 *   "runId": "run-12345",
 *   "userId": "user-123",
 *   "agentId": "agent-456",
 *   "inputData": {
 *     "query": "Hello, how are you?"
 *   }
 * }
 * 
 * 2. Send progress:
 * POST /jetstream/events/run-progress
 * {
 *   "threadId": "thread-001",
 *   "runId": "run-12345",
 *   "progress": 50,
 *   "message": "Processing...",
 *   "data": { "step": 2 }
 * }
 * 
 * 3. Complete run:
 * POST /jetstream/events/run-completed
 * {
 *   "threadId": "thread-001",
 *   "runId": "run-12345",
 *   "result": { "response": "Hello! I am doing well." },
 *   "executionTime": 5000
 * }
 * 
 * 4. Monitor active workers:
 * GET /jetstream/workers/active
 * 
 * 5. Check active locks:
 * GET /jetstream/locks/active
 * 
 * 6. Health check:
 * GET /jetstream/health
 */