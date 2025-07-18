import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '6789', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    type: 'postgres' as const,
    url: process.env.JARVIS_KIT_POSTGRES_URI || 'postgresql://localhost:5432/jarviskit',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    ssl: process.env.NODE_ENV === 'production',
  },
  
  // Redis configuration
  redis: {
    url: process.env.JARVIS_KIT_REDIS_URI || 'redis://localhost:6379',
  },
  
  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.JARVIS_KIT_RABBITMQ_URI || 'amqp://localhost:5672',
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  // WebSocket configuration
  websocket: {
    cors: {
      origin: process.env.WEBSOCKET_CORS_ORIGIN || '*',
      credentials: true,
    },
  },
};