import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ThreadService } from './thread.service.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';

const threadRoutes = new Hono();
const threadService = new ThreadService();

// Create thread schema
const createThreadSchema = z.object({
  namespace: z.string(),
  agentName: z.string(),
  name: z.string().optional(),
  mode: z.enum(['MANUAL', 'AUTO']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Update thread schema
const updateThreadSchema = z.object({
  name: z.string().optional(),
  mode: z.enum(['MANUAL', 'AUTO']).optional(),
  metadata: z.record(z.any()).optional(),
  isLocked: z.boolean().optional(),
});

// Send message schema
const sendMessageSchema = z.object({
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Apply auth middleware to all routes
threadRoutes.use('*', authMiddleware);

// Get all threads for user
threadRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { namespace, agentName } = c.req.query();
    
    const threads = await threadService.getThreadsByUser(user.id, {
      namespace,
      agentName,
    });
    
    return c.json({
      success: true,
      data: threads,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Create new thread
threadRoutes.post('/', zValidator('json', createThreadSchema), async (c) => {
  try {
    const user = c.get('user');
    const threadData = c.req.valid('json');
    
    const thread = await threadService.createThread({
      ...threadData,
      userId: user.id,
    });
    
    return c.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Get thread by ID
threadRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const threadId = c.req.param('id');
    
    const thread = await threadService.getThreadById(threadId, user.id);
    
    return c.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 404);
  }
});

// Update thread
threadRoutes.patch('/:id', zValidator('json', updateThreadSchema), async (c) => {
  try {
    const user = c.get('user');
    const threadId = c.req.param('id');
    const updateData = c.req.valid('json');
    
    const thread = await threadService.updateThread(threadId, user.id, updateData);
    
    return c.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Delete thread
threadRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const threadId = c.req.param('id');
    
    await threadService.deleteThread(threadId, user.id);
    
    return c.json({
      success: true,
      message: 'Thread deleted successfully',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Get messages for thread
threadRoutes.get('/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const threadId = c.req.param('id');
    const { limit = '50', offset = '0' } = c.req.query();
    
    const messages = await threadService.getMessages(threadId, user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    return c.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Send message to thread
threadRoutes.post('/:id/messages', zValidator('json', sendMessageSchema), async (c) => {
  try {
    const user = c.get('user');
    const threadId = c.req.param('id');
    const messageData = c.req.valid('json');
    
    const message = await threadService.sendMessage(threadId, user.id, messageData);
    
    return c.json({
      success: true,
      data: message,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

export { threadRoutes };