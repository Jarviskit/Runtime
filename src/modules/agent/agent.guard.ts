import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgentGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const apiKey = request.headers['x-agent-namespace-secret'];
    if (!apiKey) {
      throw new UnauthorizedException('No API key provided');
    }

    const agentNamespace = request.headers['x-agent-namespace'];
    if (!agentNamespace) {
      throw new UnauthorizedException('No agent namespace provided');
    }

    const namespaces = this.configService.get('namespaces');
    if (!namespaces[agentNamespace] || namespaces[agentNamespace] !== apiKey) {
      throw new UnauthorizedException('Invalid API key or agent namespace');
    }

    return true;
  }
}