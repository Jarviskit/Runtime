import { Injectable, Logger } from "@nestjs/common";
import { ThreadService } from "../thread/thread.service";
import { AGUIEvent } from "./interfaces";
import { Server } from "socket.io";
import { EventType } from '@ag-ui/core'
import { RedisService } from "@liaoliaots/nestjs-redis";
import { AGUIEventQueueService } from "./agui-event-queue.service";

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  
  constructor(
    private readonly threadService: ThreadService,
    private readonly redisService: RedisService,
    private readonly aguiEventQueueService: AGUIEventQueueService,
  ) {}

  /**
   * Handle AGUI event by queuing it for sequential processing
   */
  async handleAGUIEvent(payload: AGUIEvent, server: Server) {
    try {
      this.logger.log(`Received AGUI event for thread ${payload.threadId}, session ${payload.sessionId}, order ${payload.order}, type ${payload.event.type}`);
      
      // Queue the event for sequential processing
      await this.aguiEventQueueService.queueAGUIEvent(payload, server);
      
      this.logger.log(`Queued AGUI event for thread ${payload.threadId}, session ${payload.sessionId}, order ${payload.order}`);
    } catch (error) {
      this.logger.error(`Error queuing AGUI event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Legacy method - now deprecated in favor of queue-based processing
   * @deprecated Use AGUIEventQueueService.queueAGUIEvent instead
   */
  async handleAGUIEventDirectly(payload: AGUIEvent, server: Server) {
    console.log(`[${payload.threadId} - ${payload.sessionId} - ${payload.event.messageId} -> ${payload.event.type}] ${payload.event.delta || ''}`);
    const event = { order: payload.order, ...payload.event };

    try {
      const redis = this.redisService.getOrThrow();
      await redis.lpush(`thread:${payload.threadId}:${payload.sessionId}`, JSON.stringify(event));
      await redis.expire(`thread:${payload.threadId}:${payload.sessionId}`, 60 * 30);

      switch (payload.event.type) {
        case EventType.RUN_STARTED:
          // Set the current session id for the thread
          await this.threadService.updateThread(payload.threadId, { currentSessionId: payload.sessionId });
          break;

        case EventType.RUN_FINISHED:
          // Remove the thread from the redis list
          await Promise.all([
            redis.del(`thread:${payload.threadId}:${payload.sessionId}`),
            this.threadService.updateThread(payload.threadId, { currentSessionId: null, isLocked: false }),
          ]);
          break;

          case EventType.RUN_ERROR:
            // TODO: add new error log to the thread for debugging
            await Promise.all([
              redis.del(`thread:${payload.threadId}:${payload.sessionId}`),
              this.threadService.updateThread(payload.threadId, { currentSessionId: null, isLocked: false }),
            ]);
            break;

        case EventType.TEXT_MESSAGE_START:
          // Create a new message with content is empty
          await this.threadService.createEmptyAgentMessage(payload.threadId, payload.sessionId, payload.event.messageId);
          break;

        case EventType.TEXT_MESSAGE_END:
          // Update the message with the final content, if there is tool call, set status to "Executing" or "WaitingForClientResponse"
          await this.threadService.updateAgentMessage(payload);
          break;

        case EventType.TOOL_CALL_START:
          // Set status of tool to "Calling"
          await this.threadService.updateAgentMessageWithToolCall(payload);
          break;

        case EventType.TOOL_CALL_RESULT:
          // Set status of tool to "Completed"
          await this.threadService.updateAgentMessageWithToolCall(payload);
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling AGUI event: ${error.stack}`);
    }

    server.to(`thread:${payload.threadId}`).emit('agui_event', event);
  }
}