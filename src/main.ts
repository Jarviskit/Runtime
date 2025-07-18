import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { swaggerUI } from '@hono/swagger-ui';
import 'reflect-metadata';
import { config } from './config/index.js';
import { initializeDatabase } from './config/database.js';
import { initializeRedis } from './config/redis.js';
import { initializeRabbitMQ } from './config/rabbitmq.js';
import { initializeWebSocket } from './transports/websocket.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { threadRoutes } from './modules/thread/thread.routes.js';
import { agentRoutes } from './modules/agent/agent.routes.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Documentation
app.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/threads', threadRoutes);
app.route('/api/agents', agentRoutes);

// Initialize services
async function bootstrap() {
  try {
    console.log('🚀 Starting JarvisKit Runtime...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database connected');
    
    // Initialize Redis
    await initializeRedis();
    console.log('✅ Redis connected');
    
    // Initialize RabbitMQ
    await initializeRabbitMQ();
    console.log('✅ RabbitMQ connected');
    
    // Start HTTP server
    const server = serve({
      fetch: app.fetch,
      port: config.port,
    });
    
    // Initialize WebSocket server
    await initializeWebSocket(server);
    console.log('✅ WebSocket server started');
    
    console.log(`🎉 Server running on http://localhost:${config.port}`);
    console.log(`📚 API Documentation available at http://localhost:${config.port}/docs`);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
