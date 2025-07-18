import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AuthService } from './auth.service.js';

const authRoutes = new Hono();
const authService = new AuthService();

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

// Login endpoint
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    const result = await authService.login(email, password);
    
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

// Register endpoint
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const userData = c.req.valid('json');
    const result = await authService.register(userData);
    
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

// Verify token endpoint
authRoutes.get('/verify', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({
        success: false,
        error: 'Authorization header required',
      }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const result = await authService.verifyToken(token);
    
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 401);
  }
});

// Refresh token endpoint
authRoutes.post('/refresh', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({
        success: false,
        error: 'Authorization header required',
      }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const result = await authService.refreshToken(token);
    
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message,
    }, 401);
  }
});

export { authRoutes };