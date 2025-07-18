import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AgentService } from './agent.service.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';

const agentRoutes = new Hono();
const agentService = new AgentService();

// Create agent schema
const createAgentSchema = z.object({
  name: z.string(),
  namespace: z.string(),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  tools: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

// Update agent schema
const updateAgentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  tools: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

// Apply auth middleware to all routes
agentRoutes.use('*', authMiddleware);

// Get all agents
agentRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { namespace, isActive } = c.req.query();
    
    const agents = await agentService.getAgents({
      namespace,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      createdBy: user.id,
    });
    
    return c.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Create new agent
agentRoutes.post('/', zValidator('json', createAgentSchema), async (c) => {
  try {
    const user = c.get('user');
    const agentData = c.req.valid('json');
    
    const agent = await agentService.createAgent({
      ...agentData,
      createdBy: user.id,
    });
    
    return c.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Get agent by ID
agentRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('id');
    
    const agent = await agentService.getAgentById(agentId, user.id);
    
    return c.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 404);
  }
});

// Update agent
agentRoutes.patch('/:id', zValidator('json', updateAgentSchema), async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('id');
    const updateData = c.req.valid('json');
    
    const agent = await agentService.updateAgent(agentId, user.id, updateData);
    
    return c.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Delete agent
agentRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('id');
    
    await agentService.deleteAgent(agentId, user.id);
    
    return c.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Get agents by namespace
agentRoutes.get('/namespace/:namespace', async (c) => {
  try {
    const user = c.get('user');
    const namespace = c.req.param('namespace');
    
    const agents = await agentService.getAgentsByNamespace(namespace, user.id);
    
    return c.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

// Execute agent action
agentRoutes.post('/:id/execute', async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('id');
    const body = await c.req.json();
    
    const result = await agentService.executeAgent(agentId, user.id, body);
    
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 400);
  }
});

export { agentRoutes };