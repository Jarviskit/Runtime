import { createMiddleware } from 'hono/factory';
import { AuthService } from '../../modules/auth/auth.service.js';

const authService = new AuthService();

export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    const authorization = c.req.header('Authorization');
    
    if (!authorization) {
      return c.json({
        success: false,
        error: 'Authorization header required',
      }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const { user } = await authService.verifyToken(token);
    
    // Set user in context
    c.set('user', user);
    
    await next();
  } catch (error) {
    return c.json({
      success: false,
      error: 'Invalid or expired token',
    }, 401);
  }
});