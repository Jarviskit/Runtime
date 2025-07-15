import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '@liaoliaots/nestjs-redis';

interface ThreadStats {
  threadId: string;
  lastProcessedOrder: number;
  queueDepth: number;
  consumerCount: number;
  lastActivityTime: Date;
  processingRate: number; // events per minute
}

interface SystemStats {
  totalQueues: number;
  totalMessages: number;
  totalConsumers: number;
  averageProcessingTime: number;
  errorRate: number;
  threadsBeingProcessed: number;
}

@Injectable()
export class AGUIEventMonitorService {
  private readonly logger = new Logger(AGUIEventMonitorService.name);
  private readonly statsHistory: Map<string, ThreadStats[]> = new Map();
  private readonly processingTimes: Map<string, number[]> = new Map();
  
  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Collect system statistics every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemStats(): Promise<void> {
    try {
      const stats = await this.getSystemStats();
      this.logger.log(`System Stats: ${JSON.stringify(stats)}`);
      
      // Store stats in Redis for historical analysis
      await this.storeStatsInRedis(stats);
      
      // Check for alerts
      await this.checkAlerts(stats);
    } catch (error) {
      this.logger.error(`Failed to collect system stats: ${error.message}`);
    }
  }

  /**
   * Get comprehensive system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    const mainQueueStats = await this.rabbitmqService.getQueueStats('agui_events_queue');
    const threadStats = await this.getAllThreadStats();
    
    const totalMessages = threadStats.reduce((sum, stat) => sum + stat.queueDepth, 0) + mainQueueStats.messageCount;
    const totalConsumers = threadStats.reduce((sum, stat) => sum + stat.consumerCount, 0) + mainQueueStats.consumerCount;
    
    return {
      totalQueues: threadStats.length + 1, // +1 for main queue
      totalMessages,
      totalConsumers,
      averageProcessingTime: await this.getAverageProcessingTime(),
      errorRate: await this.getErrorRate(),
      threadsBeingProcessed: await this.getActiveThreadsCount(),
    };
  }

  /**
   * Get statistics for all threads
   */
  async getAllThreadStats(): Promise<ThreadStats[]> {
    const redis = this.redisService.getOrThrow();
    const keys = await redis.keys('thread:*:last_processed_order');
    
    const threadStats: ThreadStats[] = [];
    
    for (const key of keys) {
      const threadId = key.split(':')[1];
      const stats = await this.getThreadStats(threadId);
      if (stats) {
        threadStats.push(stats);
      }
    }
    
    return threadStats;
  }

  /**
   * Get statistics for a specific thread
   */
  async getThreadStats(threadId: string): Promise<ThreadStats | null> {
    try {
      const redis = this.redisService.getOrThrow();
      const lastProcessedOrder = await redis.get(`thread:${threadId}:last_processed_order`);
      
      if (!lastProcessedOrder) {
        return null;
      }

      const queueName = `agui_events_queue:${threadId}`;
      const queueStats = await this.rabbitmqService.getQueueStats(queueName);
      
      // Get processing rate from history
      const processingRate = await this.getProcessingRate(threadId);
      
      return {
        threadId,
        lastProcessedOrder: parseInt(lastProcessedOrder),
        queueDepth: queueStats.messageCount,
        consumerCount: queueStats.consumerCount,
        lastActivityTime: new Date(),
        processingRate,
      };
    } catch (error) {
      this.logger.error(`Failed to get thread stats for ${threadId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Record processing time for performance monitoring
   */
  async recordProcessingTime(threadId: string, processingTimeMs: number): Promise<void> {
    const times = this.processingTimes.get(threadId) || [];
    times.push(processingTimeMs);
    
    // Keep only last 100 processing times
    if (times.length > 100) {
      times.shift();
    }
    
    this.processingTimes.set(threadId, times);
    
    // Store in Redis with TTL
    const redis = this.redisService.getOrThrow();
    await redis.lpush(`thread:${threadId}:processing_times`, processingTimeMs.toString());
    await redis.ltrim(`thread:${threadId}:processing_times`, 0, 99); // Keep last 100
    await redis.expire(`thread:${threadId}:processing_times`, 60 * 60); // 1 hour TTL
  }

  /**
   * Get average processing time across all threads
   */
  private async getAverageProcessingTime(): Promise<number> {
    const redis = this.redisService.getOrThrow();
    const keys = await redis.keys('thread:*:processing_times');
    
    let totalTime = 0;
    let count = 0;
    
    for (const key of keys) {
      const times = await redis.lrange(key, 0, -1);
      for (const time of times) {
        totalTime += parseInt(time);
        count++;
      }
    }
    
    return count > 0 ? totalTime / count : 0;
  }

  /**
   * Get processing rate for a specific thread
   */
  private async getProcessingRate(threadId: string): Promise<number> {
    const redis = this.redisService.getOrThrow();
    const key = `thread:${threadId}:processing_rate`;
    
    // Use Redis sliding window counter
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Remove old entries
    await redis.zremrangebyscore(key, '-inf', oneMinuteAgo);
    
    // Count entries in the last minute
    const count = await redis.zcard(key);
    
    return count;
  }

  /**
   * Record event processing for rate calculation
   */
  async recordEventProcessed(threadId: string): Promise<void> {
    const redis = this.redisService.getOrThrow();
    const key = `thread:${threadId}:processing_rate`;
    
    // Add current timestamp to sorted set
    await redis.zadd(key, Date.now(), `${Date.now()}-${Math.random()}`);
    await redis.expire(key, 60 * 5); // 5 minutes TTL
  }

  /**
   * Get error rate
   */
  private async getErrorRate(): Promise<number> {
    const redis = this.redisService.getOrThrow();
    const totalProcessed = await redis.get('agui_events:total_processed') || '0';
    const totalErrors = await redis.get('agui_events:total_errors') || '0';
    
    const processed = parseInt(totalProcessed);
    const errors = parseInt(totalErrors);
    
    return processed > 0 ? (errors / processed) * 100 : 0;
  }

  /**
   * Get count of active threads being processed
   */
  private async getActiveThreadsCount(): Promise<number> {
    const redis = this.redisService.getOrThrow();
    const activeThreads = await redis.smembers('agui_events:active_threads');
    return activeThreads.length;
  }

  /**
   * Record error for monitoring
   */
  async recordError(threadId: string, error: Error): Promise<void> {
    const redis = this.redisService.getOrThrow();
    
    // Increment error counters
    await redis.incr('agui_events:total_errors');
    await redis.incr(`thread:${threadId}:errors`);
    
    // Store error details
    const errorData = {
      threadId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    
    await redis.lpush('agui_events:recent_errors', JSON.stringify(errorData));
    await redis.ltrim('agui_events:recent_errors', 0, 99); // Keep last 100 errors
    await redis.expire('agui_events:recent_errors', 60 * 60 * 24); // 24 hours TTL
  }

  /**
   * Record successful processing
   */
  async recordSuccess(threadId: string): Promise<void> {
    const redis = this.redisService.getOrThrow();
    await redis.incr('agui_events:total_processed');
    await this.recordEventProcessed(threadId);
  }

  /**
   * Store system stats in Redis
   */
  private async storeStatsInRedis(stats: SystemStats): Promise<void> {
    const redis = this.redisService.getOrThrow();
    const timestamp = Date.now();
    
    const statsData = {
      timestamp,
      ...stats,
    };
    
    await redis.lpush('agui_events:system_stats', JSON.stringify(statsData));
    await redis.ltrim('agui_events:system_stats', 0, 1439); // Keep last 24 hours (1 minute intervals)
    await redis.expire('agui_events:system_stats', 60 * 60 * 24); // 24 hours TTL
  }

  /**
   * Check for alerts and warnings
   */
  private async checkAlerts(stats: SystemStats): Promise<void> {
    // High queue depth alert
    if (stats.totalMessages > 1000) {
      this.logger.warn(`High queue depth detected: ${stats.totalMessages} messages`);
    }
    
    // High error rate alert
    if (stats.errorRate > 5) {
      this.logger.warn(`High error rate detected: ${stats.errorRate}%`);
    }
    
    // No consumers alert
    if (stats.totalConsumers === 0) {
      this.logger.error('No consumers detected! Events will not be processed.');
    }
    
    // Slow processing alert
    if (stats.averageProcessingTime > 5000) {
      this.logger.warn(`Slow processing detected: ${stats.averageProcessingTime}ms average`);
    }
  }

  /**
   * Get recent errors for debugging
   */
  async getRecentErrors(limit: number = 10): Promise<any[]> {
    const redis = this.redisService.getOrThrow();
    const errors = await redis.lrange('agui_events:recent_errors', 0, limit - 1);
    
    return errors.map(error => JSON.parse(error));
  }

  /**
   * Get historical system stats
   */
  async getHistoricalStats(hours: number = 24): Promise<any[]> {
    const redis = this.redisService.getOrThrow();
    const limit = hours * 60; // Convert hours to minutes
    const stats = await redis.lrange('agui_events:system_stats', 0, limit - 1);
    
    return stats.map(stat => JSON.parse(stat));
  }

  /**
   * Reset all monitoring data
   */
  async resetMonitoringData(): Promise<void> {
    const redis = this.redisService.getOrThrow();
    
    const keys = await redis.keys('agui_events:*');
    const processingKeys = await redis.keys('thread:*:processing_times');
    const rateKeys = await redis.keys('thread:*:processing_rate');
    const errorKeys = await redis.keys('thread:*:errors');
    
    const allKeys = [...keys, ...processingKeys, ...rateKeys, ...errorKeys];
    
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
    
    // Clear in-memory data
    this.statsHistory.clear();
    this.processingTimes.clear();
    
    this.logger.log('Monitoring data reset successfully');
  }
}