import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { JetStreamService } from './jetstream.service';
import { WorkerFactory } from './worker-factory.service';
import { RedisLockService } from './redis-lock.service';
import { ThreadEvent, ThreadEventType } from './interfaces/thread-event.interface';

@Controller('jetstream')
export class JetStreamController {
  constructor(
    private readonly jetStreamService: JetStreamService,
    private readonly workerFactory: WorkerFactory,
    private readonly redisLockService: RedisLockService,
  ) {}

  @Post('events/publish')
  async publishEvent(@Body() body: {
    threadId: string;
    event: ThreadEvent;
  }) {
    await this.jetStreamService.publishThreadEvent(body.threadId, body.event);
    return { success: true, message: 'Event published successfully' };
  }

  @Post('events/run-started')
  async publishRunStarted(@Body() body: {
    threadId: string;
    runId: string;
    userId: string;
    agentId: string;
    inputData: any;
  }) {
    const event: ThreadEvent = {
      type: ThreadEventType.RUN_STARTED,
      threadId: body.threadId,
      runId: body.runId,
      timestamp: Date.now(),
      payload: {
        userId: body.userId,
        agentId: body.agentId,
        inputData: body.inputData,
      },
    };

    await this.jetStreamService.publishThreadEvent(body.threadId, event);
    return { success: true, message: 'RUN_STARTED event published successfully' };
  }

  @Post('events/run-progress')
  async publishRunProgress(@Body() body: {
    threadId: string;
    runId: string;
    progress: number;
    message: string;
    data?: any;
  }) {
    const event: ThreadEvent = {
      type: ThreadEventType.RUN_PROGRESS,
      threadId: body.threadId,
      runId: body.runId,
      timestamp: Date.now(),
      payload: {
        progress: body.progress,
        message: body.message,
        data: body.data,
      },
    };

    await this.jetStreamService.publishThreadEvent(body.threadId, event);
    return { success: true, message: 'RUN_PROGRESS event published successfully' };
  }

  @Post('events/run-completed')
  async publishRunCompleted(@Body() body: {
    threadId: string;
    runId: string;
    result: any;
    executionTime: number;
  }) {
    const event: ThreadEvent = {
      type: ThreadEventType.RUN_COMPLETED,
      threadId: body.threadId,
      runId: body.runId,
      timestamp: Date.now(),
      payload: {
        result: body.result,
        executionTime: body.executionTime,
      },
    };

    await this.jetStreamService.publishThreadEvent(body.threadId, event);
    return { success: true, message: 'RUN_COMPLETED event published successfully' };
  }

  @Post('events/run-failed')
  async publishRunFailed(@Body() body: {
    threadId: string;
    runId: string;
    error: string;
    stackTrace?: string;
  }) {
    const event: ThreadEvent = {
      type: ThreadEventType.RUN_FAILED,
      threadId: body.threadId,
      runId: body.runId,
      timestamp: Date.now(),
      payload: {
        error: body.error,
        stackTrace: body.stackTrace,
      },
    };

    await this.jetStreamService.publishThreadEvent(body.threadId, event);
    return { success: true, message: 'RUN_FAILED event published successfully' };
  }

  @Post('events/run-cancelled')
  async publishRunCancelled(@Body() body: {
    threadId: string;
    runId: string;
    reason: string;
  }) {
    const event: ThreadEvent = {
      type: ThreadEventType.RUN_CANCELLED,
      threadId: body.threadId,
      runId: body.runId,
      timestamp: Date.now(),
      payload: {
        reason: body.reason,
      },
    };

    await this.jetStreamService.publishThreadEvent(body.threadId, event);
    return { success: true, message: 'RUN_CANCELLED event published successfully' };
  }

  @Get('workers/active')
  getActiveWorkers() {
    return {
      instance: this.workerFactory.getInstanceInfo(),
      workers: this.workerFactory.getActiveWorkers(),
    };
  }

  @Delete('workers/:runId')
  async forceStopWorker(@Param('runId') runId: string) {
    const stopped = await this.workerFactory.forceStopWorker(runId);
    return {
      success: stopped,
      message: stopped ? 'Worker stopped successfully' : 'Worker not found or already stopped',
    };
  }

  @Get('locks/active')
  async getActiveLocks() {
    return await this.redisLockService.getActiveLocks();
  }

  @Get('locks/:runId/owner')
  async getLockOwner(@Param('runId') runId: string) {
    const owner = await this.redisLockService.getLockOwner(runId);
    return {
      runId,
      owner: owner || null,
      isLocked: owner !== null,
    };
  }

  @Delete('locks/force-release-all')
  async forceReleaseAllLocks() {
    const count = await this.redisLockService.forceReleaseAllLocks();
    return {
      success: true,
      message: `${count} locks released`,
      count,
    };
  }

  @Get('health')
  async getHealth() {
    try {
      const connection = this.jetStreamService.getConnection();
      const isConnected = !connection.isClosed();
      
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        nats: {
          connected: isConnected,
          servers: connection.getServer(),
        },
        instance: this.workerFactory.getInstanceInfo(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('streams/info')
  async getStreamInfo() {
    try {
      const jsm = this.jetStreamService.getJetStreamManager();
      const stream = await jsm.streams.info('JARVISKIT_STREAM');
      
      return {
        stream: stream,
        consumers: await jsm.consumers.list('JARVISKIT_STREAM').next(),
      };
    } catch (error) {
      return {
        error: error.message,
        message: 'Failed to get stream info',
      };
    }
  }
}