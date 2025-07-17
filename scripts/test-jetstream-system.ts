#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { JetStreamService } from '../src/modules/jetstream/jetstream.service';
import { WorkerFactory } from '../src/modules/jetstream/worker-factory.service';
import { RedisLockService } from '../src/modules/jetstream/redis-lock.service';
import { ThreadEventType } from '../src/modules/jetstream/interfaces/thread-event.interface';

async function testJetStreamSystem() {
  console.log('🚀 Starting JetStream System Test...\n');

  // Create NestJS application
  const app = await NestFactory.create(AppModule);
  
  // Get services
  const jetStreamService = app.get(JetStreamService);
  const workerFactory = app.get(WorkerFactory);
  const redisLockService = app.get(RedisLockService);

  // Wait for services to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📊 Initial System Status:');
  console.log('- Active Workers:', workerFactory.getActiveWorkers().length);
  console.log('- Active Locks:', (await redisLockService.getActiveLocks()).length);
  console.log('- Instance Info:', workerFactory.getInstanceInfo());
  console.log('');

  // Test 1: Single thread sequential processing
  console.log('🧪 Test 1: Single Thread Sequential Processing');
  await testSingleThreadSequential(jetStreamService);

  // Wait and check status
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('📊 After Test 1:');
  console.log('- Active Workers:', workerFactory.getActiveWorkers().length);
  console.log('- Active Locks:', (await redisLockService.getActiveLocks()).length);
  console.log('');

  // Test 2: Multiple threads concurrent processing
  console.log('🧪 Test 2: Multiple Threads Concurrent Processing');
  await testMultipleThreadsConcurrent(jetStreamService);

  // Wait and check status
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('📊 After Test 2:');
  console.log('- Active Workers:', workerFactory.getActiveWorkers().length);
  console.log('- Active Locks:', (await redisLockService.getActiveLocks()).length);
  console.log('');

  // Test 3: Error handling
  console.log('🧪 Test 3: Error Handling (Failed Run)');
  await testErrorHandling(jetStreamService);

  // Wait and check status
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('📊 After Test 3:');
  console.log('- Active Workers:', workerFactory.getActiveWorkers().length);
  console.log('- Active Locks:', (await redisLockService.getActiveLocks()).length);
  console.log('');

  // Test 4: Cancellation
  console.log('🧪 Test 4: Run Cancellation');
  await testCancellation(jetStreamService);

  // Final status
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('📊 Final System Status:');
  console.log('- Active Workers:', workerFactory.getActiveWorkers().length);
  console.log('- Active Locks:', (await redisLockService.getActiveLocks()).length);
  console.log('');

  console.log('✅ All tests completed successfully!');
  
  // Cleanup
  await app.close();
}

async function testSingleThreadSequential(jetStreamService: JetStreamService) {
  const threadId = 'test-thread-001';
  const runId = 'test-run-001';

  console.log(`   📤 Publishing RUN_STARTED for ${threadId}/${runId}`);
  
  // Start the run
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_STARTED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      userId: 'test-user-001',
      agentId: 'test-agent-001',
      inputData: {
        query: 'Test sequential processing',
        context: 'unit test'
      }
    }
  });

  // Send progress updates
  for (let i = 1; i <= 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`   📤 Publishing RUN_PROGRESS ${i * 33}%`);
    await jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_PROGRESS,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        progress: i * 33,
        message: `Processing step ${i} of 3`,
        data: { step: i }
      }
    });
  }

  // Complete the run
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`   📤 Publishing RUN_COMPLETED`);
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_COMPLETED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      result: {
        response: 'Sequential processing completed successfully',
        processed_steps: 3
      },
      executionTime: 2000
    }
  });

  console.log(`   ✅ Single thread test completed\n`);
}

async function testMultipleThreadsConcurrent(jetStreamService: JetStreamService) {
  const promises = [];

  // Start 3 concurrent threads
  for (let i = 1; i <= 3; i++) {
    promises.push(runConcurrentThread(jetStreamService, i));
  }

  await Promise.all(promises);
  console.log(`   ✅ Multiple threads test completed\n`);
}

async function runConcurrentThread(jetStreamService: JetStreamService, threadNumber: number) {
  const threadId = `test-thread-${threadNumber.toString().padStart(3, '0')}`;
  const runId = `test-run-concurrent-${threadNumber}`;

  console.log(`   📤 Thread ${threadNumber}: Publishing RUN_STARTED`);
  
  // Start
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_STARTED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      userId: `test-user-${threadNumber}`,
      agentId: `test-agent-${threadNumber}`,
      inputData: {
        query: `Concurrent test query ${threadNumber}`,
        thread: threadNumber
      }
    }
  });

  // Progress
  for (let step = 1; step <= 2; step++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`   📤 Thread ${threadNumber}: Progress ${step * 50}%`);
    await jetStreamService.publishThreadEvent(threadId, {
      type: ThreadEventType.RUN_PROGRESS,
      threadId,
      runId,
      timestamp: Date.now(),
      payload: {
        progress: step * 50,
        message: `Thread ${threadNumber} - Step ${step}`,
        data: { thread: threadNumber, step }
      }
    });
  }

  // Complete
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(`   📤 Thread ${threadNumber}: Publishing RUN_COMPLETED`);
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_COMPLETED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      result: {
        response: `Concurrent processing completed for thread ${threadNumber}`,
        thread: threadNumber
      },
      executionTime: 900
    }
  });

  console.log(`   ✅ Thread ${threadNumber} completed`);
}

async function testErrorHandling(jetStreamService: JetStreamService) {
  const threadId = 'test-thread-error';
  const runId = 'test-run-error';

  console.log(`   📤 Publishing RUN_STARTED for error test`);
  
  // Start the run
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_STARTED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      userId: 'test-user-error',
      agentId: 'test-agent-error',
      inputData: {
        query: 'This will fail',
        simulate_error: true
      }
    }
  });

  // Some progress
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`   📤 Publishing RUN_PROGRESS 30%`);
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_PROGRESS,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      progress: 30,
      message: 'Processing before error...',
      data: { step: 1 }
    }
  });

  // Simulate failure
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`   📤 Publishing RUN_FAILED`);
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_FAILED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      error: 'Simulated processing error',
      stackTrace: 'Error: Simulated processing error\n    at TestProcessor.process(test.ts:123)\n    at Worker.handle(worker.ts:456)'
    }
  });

  console.log(`   ✅ Error handling test completed\n`);
}

async function testCancellation(jetStreamService: JetStreamService) {
  const threadId = 'test-thread-cancel';
  const runId = 'test-run-cancel';

  console.log(`   📤 Publishing RUN_STARTED for cancellation test`);
  
  // Start the run
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_STARTED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      userId: 'test-user-cancel',
      agentId: 'test-agent-cancel',
      inputData: {
        query: 'Long running query that will be cancelled',
        long_running: true
      }
    }
  });

  // Some progress
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`   📤 Publishing RUN_PROGRESS 25%`);
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_PROGRESS,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      progress: 25,
      message: 'Processing long running query...',
      data: { step: 1 }
    }
  });

  // Cancel
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`   📤 Publishing RUN_CANCELLED`);
  await jetStreamService.publishThreadEvent(threadId, {
    type: ThreadEventType.RUN_CANCELLED,
    threadId,
    runId,
    timestamp: Date.now(),
    payload: {
      reason: 'User requested cancellation during test'
    }
  });

  console.log(`   ✅ Cancellation test completed\n`);
}

// Run the test
if (require.main === module) {
  testJetStreamSystem()
    .then(() => {
      console.log('🎉 Test script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

export { testJetStreamSystem };