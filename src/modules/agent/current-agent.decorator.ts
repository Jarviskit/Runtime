import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RegisteredAgent } from "src/shared/interfaces";


export const CurrentAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RegisteredAgent => {
    const request = ctx.switchToHttp().getRequest();
    return {
      namespace: request.headers['x-agent-namespace'],
      agentName: request.headers['x-agent-name'],
    }
  },
);