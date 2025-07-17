import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { 
  AGUIEventRequest, 
  AGUIEventResponse, 
  JoinAgentSpaceRequest, 
  ClientResponse,
  GetThreadMessagesRequest,
  GetThreadMessagesResponse 
} from '../../generated/agent-runtime';
import { ThreadService } from '../thread/thread.service';
import { AGUIEvent } from '../socket/interfaces';
import { EventType } from '@ag-ui/core';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class GrpcService {
  private readonly logger = new Logger(GrpcService.name);
  
  // Store active agent streams by namespace
  private agentStreams = new Map<string, Subject<ClientResponse>>();
  
  // Store session event queues to ensure sequential processing
  private sessionQueues = new Map<string, Array<{ event: AGUIEvent, resolve: Function, reject: Function }>>();
  private sessionProcessing = new Map<string, boolean>();

  constructor(
    private readonly threadService: ThreadService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async sendAGUIEvent(request: AGUIEventRequest): Promise<AGUIEventResponse> {
    try {
      // Convert gRPC request to internal AGUIEvent format
      const aguiEvent: AGUIEvent = {
        threadId: request.threadId,
        sessionId: request.sessionId,
        event: {
          type: request.event?.type || '',
          messageId: request.event?.messageId || '',
          delta: request.event?.delta || '',
          content: request.event?.content || '',
          toolCalls: request.event?.toolCalls || [],
          metadata: request.event?.metadata || {},
          timestamp: request.event?.timestamp || Date.now()
        },
        metadata: request.metadata || {},
        order: request.order
      };

      // Add to session queue for sequential processing
      await this.addToSessionQueue(aguiEvent);

      return {
        success: true,
        message: 'Event processed successfully',
        error: ''
      };
    } catch (error) {
      this.logger.error(`Error processing AGUI event: ${error.stack}`);
      return {
        success: false,
        message: 'Failed to process event',
        error: error.message
      };
    }
  }

  joinAgentSpace(request: JoinAgentSpaceRequest): Observable<ClientResponse> {
    const { name, api_key } = request;
    
    this.logger.warn(`Agent joined space: ${name} | API Key: ${api_key}`);
    
    // Create a new subject for this agent's stream
    const stream = new Subject<ClientResponse>();
    this.agentStreams.set(name, stream);

    // Clean up when stream ends
    stream.subscribe({
      complete: () => {
        this.agentStreams.delete(name);
        this.logger.warn(`Agent left space: ${name}`);
      },
      error: (error) => {
        this.logger.error(`Agent stream error for ${name}: ${error}`);
        this.agentStreams.delete(name);
      }
    });

    return stream.asObservable();
  }

  async getThreadMessages(request: GetThreadMessagesRequest): Promise<GetThreadMessagesResponse> {
    try {
      // For now, return empty response - would need agent authentication
      // This would be implemented based on the existing agent authentication logic
      return {
        messages: [],
        total: 0,
        page: request.page || 1,
        limit: request.limit || 10
      };
    } catch (error) {
      this.logger.error(`Error getting thread messages: ${error.stack}`);
      throw error;
    }
  }

  // Send response to agent via gRPC stream
  sendClientResponse(namespace: string, response: ClientResponse) {
    const stream = this.agentStreams.get(namespace);
    if (stream) {
      stream.next(response);
    } else {
      this.logger.warn(`No active stream found for namespace: ${namespace}`);
    }
  }

  private async addToSessionQueue(event: AGUIEvent) {
    const sessionKey = `${event.threadId}:${event.sessionId}`;
    
    return new Promise<void>((resolve, reject) => {
      // Add to queue
      if (!this.sessionQueues.has(sessionKey)) {
        this.sessionQueues.set(sessionKey, []);
      }
      
      this.sessionQueues.get(sessionKey)!.push({ event, resolve, reject });
      
      // Process queue if not already processing
      if (!this.sessionProcessing.get(sessionKey)) {
        this.processSessionQueue(sessionKey);
      }
    });
  }

  private async processSessionQueue(sessionKey: string) {
    if (this.sessionProcessing.get(sessionKey)) {
      return;
    }

    this.sessionProcessing.set(sessionKey, true);
    const queue = this.sessionQueues.get(sessionKey);

    if (!queue) {
      this.sessionProcessing.set(sessionKey, false);
      return;
    }

    try {
      while (queue.length > 0) {
        const { event, resolve, reject } = queue.shift()!;
        
        try {
          await this.handleAGUIEvent(event);
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.sessionProcessing.set(sessionKey, false);
      
      // Clean up empty queues
      if (queue.length === 0) {
        this.sessionQueues.delete(sessionKey);
        this.sessionProcessing.delete(sessionKey);
      }
    }
  }

  private async handleAGUIEvent(payload: AGUIEvent) {
    console.log(`[${payload.threadId} - ${payload.sessionId} - ${payload.event.messageId} -> ${payload.event.type}] ${payload.event.delta || ''}`);
    
    const event = { order: payload.order, ...payload.event };

    try {
      const redis = this.redisService.getOrThrow();
      await redis.lpush(`thread:${payload.threadId}:${payload.sessionId}`, JSON.stringify(event));
      await redis.expire(`thread:${payload.threadId}:${payload.sessionId}`, 60 * 30);

      switch (payload.event.type) {
        case EventType.RUN_STARTED:
          await this.threadService.updateThread(payload.threadId, { currentSessionId: payload.sessionId });
          break;

        case EventType.RUN_FINISHED:
          await Promise.all([
            redis.del(`thread:${payload.threadId}:${payload.sessionId}`),
            this.threadService.updateThread(payload.threadId, { currentSessionId: null, isLocked: false }),
          ]);
          break;

        case EventType.RUN_ERROR:
          await Promise.all([
            redis.del(`thread:${payload.threadId}:${payload.sessionId}`),
            this.threadService.updateThread(payload.threadId, { currentSessionId: null, isLocked: false }),
          ]);
          break;

        case EventType.TEXT_MESSAGE_START:
          await this.threadService.createEmptyAgentMessage(payload.threadId, payload.sessionId, payload.event.messageId);
          break;

        case EventType.TEXT_MESSAGE_END:
          await this.threadService.updateAgentMessage(payload);
          break;

        case EventType.TOOL_CALL_START:
          await this.threadService.updateAgentMessageWithToolCall(payload);
          break;

        case EventType.TOOL_CALL_RESULT:
          await this.threadService.updateAgentMessageWithToolCall(payload);
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling AGUI event: ${error.stack}`);
      throw error;
    }

    // Emit to websocket clients (maintaining backward compatibility)
    this.eventEmitter.emit('agui_event', {
      threadId: payload.threadId,
      event: event
    });
  }
}