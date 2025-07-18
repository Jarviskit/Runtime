import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { config } from '../config/index.js';
import { getRabbitMQChannel } from '../config/rabbitmq.js';
import { getRedisClient } from '../config/redis.js';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
}

export let wss: WebSocketServer;
const clients = new Map<string, AuthenticatedWebSocket>();

export async function initializeWebSocket(server: Server): Promise<void> {
  wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  wss.on('connection', async (ws: AuthenticatedWebSocket, request) => {
    console.log('New WebSocket connection');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        await handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' },
          timestamp: new Date().toISOString(),
        }));
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`WebSocket connection closed for user: ${ws.userId}`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Subscribe to RabbitMQ events for broadcasting
  await subscribeToEvents();
  
  console.log('WebSocket server initialized');
}

async function handleWebSocketMessage(ws: AuthenticatedWebSocket, message: any): Promise<void> {
  switch (message.type) {
    case 'auth':
      await handleAuth(ws, message.data);
      break;
    case 'join_thread':
      await handleJoinThread(ws, message.data);
      break;
    case 'leave_thread':
      await handleLeaveThread(ws, message.data);
      break;
    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        data: {},
        timestamp: new Date().toISOString(),
      }));
      break;
    default:
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Unknown message type' },
        timestamp: new Date().toISOString(),
      }));
  }
}

async function handleAuth(ws: AuthenticatedWebSocket, data: any): Promise<void> {
  // TODO: Implement JWT token validation
  const { token } = data;
  
  if (!token) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      data: { message: 'Token required' },
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // For now, mock authentication
  ws.userId = 'user_' + Math.random().toString(36).substr(2, 9);
  ws.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
  
  clients.set(ws.userId, ws);
  
  ws.send(JSON.stringify({
    type: 'auth_success',
    data: { 
      userId: ws.userId,
      sessionId: ws.sessionId,
    },
    timestamp: new Date().toISOString(),
  }));
}

async function handleJoinThread(ws: AuthenticatedWebSocket, data: any): Promise<void> {
  const { threadId } = data;
  
  if (!ws.userId) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Authentication required' },
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Store thread subscription in Redis
  const redis = getRedisClient();
  await redis.sadd(`thread:${threadId}:subscribers`, ws.userId);
  await redis.sadd(`user:${ws.userId}:threads`, threadId);
  
  ws.send(JSON.stringify({
    type: 'thread_joined',
    data: { threadId },
    timestamp: new Date().toISOString(),
  }));
}

async function handleLeaveThread(ws: AuthenticatedWebSocket, data: any): Promise<void> {
  const { threadId } = data;
  
  if (!ws.userId) return;

  // Remove thread subscription from Redis
  const redis = getRedisClient();
  await redis.srem(`thread:${threadId}:subscribers`, ws.userId);
  await redis.srem(`user:${ws.userId}:threads`, threadId);
  
  ws.send(JSON.stringify({
    type: 'thread_left',
    data: { threadId },
    timestamp: new Date().toISOString(),
  }));
}

async function subscribeToEvents(): Promise<void> {
  const channel = getRabbitMQChannel();
  
  // Subscribe to thread events
  await channel.consume('thread.updates', async (msg) => {
    if (msg) {
      const event = JSON.parse(msg.content.toString());
      await broadcastToThreadSubscribers(event.threadId, {
        type: 'thread_update',
        data: event,
        timestamp: new Date().toISOString(),
      });
      channel.ack(msg);
    }
  });
  
  // Subscribe to message events
  await channel.consume('message.processing', async (msg) => {
    if (msg) {
      const event = JSON.parse(msg.content.toString());
      await broadcastToThreadSubscribers(event.threadId, {
        type: 'message_update',
        data: event,
        timestamp: new Date().toISOString(),
      });
      channel.ack(msg);
    }
  });
}

async function broadcastToThreadSubscribers(threadId: string, message: WebSocketMessage): Promise<void> {
  const redis = getRedisClient();
  const subscribers = await redis.smembers(`thread:${threadId}:subscribers`);
  
  subscribers.forEach(userId => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

export function broadcastToUser(userId: string, message: WebSocketMessage): void {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcastToAll(message: WebSocketMessage): void {
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}