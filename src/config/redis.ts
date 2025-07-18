import Redis from 'ioredis';
import { config } from './index.js';

export let redisClient: Redis;

export async function initializeRedis(): Promise<void> {
  try {
    redisClient = new Redis(config.redis.url);
    
    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });
    
    // Test connection
    await redisClient.ping();
    console.log('Redis connection initialized successfully');
  } catch (error) {
    console.error('Error during Redis initialization:', error);
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}