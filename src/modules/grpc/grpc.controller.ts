import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { 
  AGUIEventRequest, 
  AGUIEventResponse, 
  JoinAgentSpaceRequest, 
  ClientResponse,
  GetThreadMessagesRequest,
  GetThreadMessagesResponse 
} from '../../generated/agent-runtime';
import { GrpcService } from './grpc.service';

@Controller()
export class GrpcController {
  private readonly logger = new Logger(GrpcController.name);

  constructor(private readonly grpcService: GrpcService) {}

  @GrpcMethod('AgentRuntimeService', 'SendAGUIEvent')
  async sendAGUIEvent(request: AGUIEventRequest): Promise<AGUIEventResponse> {
    this.logger.debug(`Received AGUI event: ${request.threadId}:${request.sessionId}:${request.event?.type}`);
    return this.grpcService.sendAGUIEvent(request);
  }

  @GrpcStreamMethod('AgentRuntimeService', 'JoinAgentSpace')
  joinAgentSpace(request: JoinAgentSpaceRequest): Observable<ClientResponse> {
    this.logger.debug(`Agent joining space: ${request.name}`);
    return this.grpcService.joinAgentSpace(request);
  }

  @GrpcMethod('AgentRuntimeService', 'GetThreadMessages')
  async getThreadMessages(request: GetThreadMessagesRequest): Promise<GetThreadMessagesResponse> {
    this.logger.debug(`Getting thread messages: ${request.threadId}`);
    return this.grpcService.getThreadMessages(request);
  }
}