import { Module } from '@nestjs/common';
import { JetStreamService } from './jetstream.service';
import { WorkerFactory } from './worker-factory.service';
import { ThreadWorkerService } from './thread-worker.service';
import { RedisLockService } from './redis-lock.service';
import { JetStreamController } from './jetstream.controller';

@Module({
  controllers: [JetStreamController],
  providers: [
    JetStreamService,
    WorkerFactory,
    ThreadWorkerService,
    RedisLockService,
  ],
  exports: [
    JetStreamService,
    WorkerFactory,
    ThreadWorkerService,
    RedisLockService,
  ],
})
export class JetStreamModule {}