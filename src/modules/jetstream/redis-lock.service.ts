import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly LOCK_PREFIX = 'jarviskit:thread:lock:';
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds
  private readonly EXTEND_INTERVAL = 60; // 1 minute in seconds

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Acquire a distributed lock for a run_id
   * @param runId - The run ID to lock
   * @param instanceId - Unique identifier for this instance
   * @param ttl - Time to live in seconds (default: 300)
   * @returns Promise<boolean> - true if lock acquired, false otherwise
   */
  async acquireLock(runId: string, instanceId: string, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    const lockKey = this.getLockKey(runId);
    
    try {
      const result = await this.redis.set(
        lockKey,
        instanceId,
        'EX', // Set expiration
        ttl,
        'NX' // Only set if key doesn't exist
      );

      const acquired = result === 'OK';
      
      if (acquired) {
        this.logger.log(`Lock acquired for run ${runId} by instance ${instanceId}`);
        // Start auto-extend mechanism
        this.startAutoExtend(runId, instanceId, ttl);
      } else {
        this.logger.warn(`Failed to acquire lock for run ${runId} by instance ${instanceId}`);
      }

      return acquired;
    } catch (error) {
      this.logger.error(`Error acquiring lock for run ${runId}`, error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * @param runId - The run ID to unlock
   * @param instanceId - Unique identifier for this instance
   * @returns Promise<boolean> - true if lock released, false otherwise
   */
  async releaseLock(runId: string, instanceId: string): Promise<boolean> {
    const lockKey = this.getLockKey(runId);
    
    // Lua script to ensure we only delete the lock if we own it
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(luaScript, 1, lockKey, instanceId);
      const released = result === 1;
      
      if (released) {
        this.logger.log(`Lock released for run ${runId} by instance ${instanceId}`);
        this.stopAutoExtend(runId);
      } else {
        this.logger.warn(`Failed to release lock for run ${runId} by instance ${instanceId} (not owner or already released)`);
      }

      return released;
    } catch (error) {
      this.logger.error(`Error releasing lock for run ${runId}`, error);
      return false;
    }
  }

  /**
   * Check if a lock is held by this instance
   * @param runId - The run ID to check
   * @param instanceId - Unique identifier for this instance
   * @returns Promise<boolean> - true if lock is held by this instance
   */
  async isLockHeld(runId: string, instanceId: string): Promise<boolean> {
    const lockKey = this.getLockKey(runId);
    
    try {
      const lockOwner = await this.redis.get(lockKey);
      return lockOwner === instanceId;
    } catch (error) {
      this.logger.error(`Error checking lock for run ${runId}`, error);
      return false;
    }
  }

  /**
   * Get the current lock owner for a run
   * @param runId - The run ID to check
   * @returns Promise<string | null> - The instance ID that owns the lock, or null if no lock
   */
  async getLockOwner(runId: string): Promise<string | null> {
    const lockKey = this.getLockKey(runId);
    
    try {
      return await this.redis.get(lockKey);
    } catch (error) {
      this.logger.error(`Error getting lock owner for run ${runId}`, error);
      return null;
    }
  }

  /**
   * Extend the TTL of a lock
   * @param runId - The run ID to extend
   * @param instanceId - Unique identifier for this instance
   * @param ttl - New TTL in seconds
   * @returns Promise<boolean> - true if lock extended, false otherwise
   */
  async extendLock(runId: string, instanceId: string, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    const lockKey = this.getLockKey(runId);
    
    // Lua script to extend TTL only if we own the lock
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(luaScript, 1, lockKey, instanceId, ttl);
      const extended = result === 1;
      
      if (extended) {
        this.logger.debug(`Lock extended for run ${runId} by instance ${instanceId}`);
      } else {
        this.logger.warn(`Failed to extend lock for run ${runId} by instance ${instanceId} (not owner)`);
      }

      return extended;
    } catch (error) {
      this.logger.error(`Error extending lock for run ${runId}`, error);
      return false;
    }
  }

  private getLockKey(runId: string): string {
    return `${this.LOCK_PREFIX}${runId}`;
  }

  // Auto-extend mechanism to prevent locks from expiring during long-running operations
  private autoExtendIntervals = new Map<string, NodeJS.Timeout>();

  private startAutoExtend(runId: string, instanceId: string, ttl: number): void {
    // Clear any existing interval
    this.stopAutoExtend(runId);
    
    const interval = setInterval(async () => {
      const extended = await this.extendLock(runId, instanceId, ttl);
      if (!extended) {
        // If we can't extend the lock, stop trying
        this.stopAutoExtend(runId);
      }
    }, this.EXTEND_INTERVAL * 1000);

    this.autoExtendIntervals.set(runId, interval);
  }

  private stopAutoExtend(runId: string): void {
    const interval = this.autoExtendIntervals.get(runId);
    if (interval) {
      clearInterval(interval);
      this.autoExtendIntervals.delete(runId);
    }
  }

  /**
   * Get all active locks (for debugging/monitoring)
   * @returns Promise<{runId: string, owner: string, ttl: number}[]>
   */
  async getActiveLocks(): Promise<{runId: string, owner: string, ttl: number}[]> {
    try {
      const keys = await this.redis.keys(`${this.LOCK_PREFIX}*`);
      const locks = [];

      for (const key of keys) {
        const owner = await this.redis.get(key);
        const ttl = await this.redis.ttl(key);
        
        if (owner && ttl > 0) {
          locks.push({
            runId: key.replace(this.LOCK_PREFIX, ''),
            owner,
            ttl
          });
        }
      }

      return locks;
    } catch (error) {
      this.logger.error('Error getting active locks', error);
      return [];
    }
  }

  /**
   * Force release all locks (use with caution, mainly for cleanup)
   * @returns Promise<number> - Number of locks released
   */
  async forceReleaseAllLocks(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.LOCK_PREFIX}*`);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.logger.warn(`Force released ${result} locks`);
      
      // Clear all auto-extend intervals
      this.autoExtendIntervals.forEach((interval) => clearInterval(interval));
      this.autoExtendIntervals.clear();
      
      return result;
    } catch (error) {
      this.logger.error('Error force releasing locks', error);
      return 0;
    }
  }
}