import { ForbiddenException, Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Thread } from "src/entities/thread.entity";
import { Repository } from "typeorm";

import { Message, ToolStatus } from "src/entities/message.entity";
import { AddUserMessageDto } from "./dtos/add-user-message.dto";
import { CreateThreadDto } from "./dtos/create-thread.dto";
import { v4 as uuidv4 } from 'uuid';
import { PaginatedQuery } from "src/shared/dto";
import { ThreadMode } from "src/shared/enum";
import { FindThreadDto } from "./dtos/find-thread.dto";
import { RabbitMQService } from "../rabbitmq/rabbitmq.service";
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { RedisService } from "@liaoliaots/nestjs-redis";
import { AGUIEvent } from "../socket/interfaces";
import { EventType } from "@ag-ui/core";
import { AuthenticatedUser, MessageEvent, RegisteredAgent } from "src/shared/interfaces";
import { SendToolResponseDto } from "./dtos/send-tool-response.dto";
import { UpdateThreadDto } from "./dtos/update-thread.dto";


@Injectable()
export class ThreadService {
  private readonly logger = new Logger(ThreadService.name);
  
  constructor(
    @InjectRepository(Thread) private threadRepository: Repository<Thread>,
    @InjectRepository(Message) private messageRepository: Repository<Message>,
    private rabbitmqService: RabbitMQService,
    private eventEmitter: EventEmitter2,
    private redisService: RedisService
  ) {}

  createThread(payload: CreateThreadDto, user: AuthenticatedUser) {
    const { name } = payload;
    const thread = this.threadRepository.create({
      id: uuidv4(),
      userId: user.id,
      name,
    });

    return this.threadRepository.save(thread);
  }

  async getThreadById(id: string, user: AuthenticatedUser) {
    const thread = await this.threadRepository.findOne({ where: { id, userId: user.id } });
    return thread;
  }
  
  async getThreads(payload: FindThreadDto, user: AuthenticatedUser) {
    const { page, limit } = payload;
    
    const [threads, total] = await this.threadRepository.findAndCount({
      where: { userId: user.id },
      order: { lastMessageAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    
    return { data: threads, total }
  }

  async getThreadMessages(threadId: string, payload: PaginatedQuery, user: AuthenticatedUser) {
    const { page, limit } = payload;

    const thread = await this.threadRepository.findOne({ where: { id: threadId, userId: user.id } });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { thread: threadId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data: messages.reverse(), total };
  }

  async sendUserMessage(threadId: string, payload: AddUserMessageDto, user: AuthenticatedUser) {
    const { content } = payload;
      
    let thread = await this.threadRepository.findOne({ where: { id: threadId, userId: user.id } });
    if (thread && thread.userId !== user.id) {
      throw new ForbiddenException('You are not allowed to send message to this thread');
    }

    if (thread && thread.isLocked) {
      throw new BadRequestException('Thread is currently locked. Please wait for agent response');
    }

    if (!thread) {
      thread = this.threadRepository.create({
        id: threadId,
        userId: user.id,
        namespace: payload.namespace,
        agentName: payload.agentName,
        mode: ThreadMode.AGENT,
        numOfMessages: 0,
        isLocked: false
      });

      await this.threadRepository.save(thread);
    }

    thread.lastMessageAt = new Date();
    thread.numOfMessages++;
    if (thread.mode === ThreadMode.AGENT) {
      thread.isLocked = true;

      if (thread.namespace !== payload.namespace || thread.agentName !== payload.agentName) {
        throw new BadRequestException('Agent space and agent name do not match');
      }
    }

    const message = this.messageRepository.create({
      id: uuidv4(),
      thread: threadId,
      content,
      role: 'user',
    });

    const [savedMessage] = await Promise.all([
      this.messageRepository.save(message),
      this.threadRepository.save(thread)
    ]);

    this.eventEmitter.emit('user.send_message', message);

    if (thread.mode === ThreadMode.AGENT) {
      const event: MessageEvent = {
        namespace: thread.namespace,
        agentName: thread.agentName,
        sentAt: new Date().toISOString(),
        message,
        config: payload.config || {}
      }
      
      this.rabbitmqService.publishThreadEvent(event).catch((error) => {
        console.error("Failed to publish thread event", threadId, error);
      });
    }

    return savedMessage;
  }

  // This message is using for ADMIN to send message to USER as AGENT
  async sendAgentMessage(threadId: string, payload: any, user: AuthenticatedUser) {
    const { content } = payload;

    const message = this.messageRepository.create({
      id: uuidv4(),
      thread: threadId,
      content,
      role: 'agent',
    });

    const savedMessage = await this.messageRepository.save(message);

    const thread = await this.threadRepository.findOne({ where: { id: threadId, userId: user.id } });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    thread.lastMessageAt = new Date();
    thread.numOfMessages++;

    await this.threadRepository.save(thread);

    this.eventEmitter.emit('agent.send_message', { threadId, message });

    return savedMessage;
  }

  

  async getCachedEvents(threadId: string, sessionId: string, user: AuthenticatedUser) {
    const thread = await this.threadRepository.findOne({ where: { id: threadId, userId: user.id } });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const redis = this.redisService.getOrThrow();
    const events = await redis.lrange(`thread:${threadId}:${sessionId}`, 0, -1);
    return events.map(event => JSON.parse(event));
  }

  async sendClientResponse(payload: SendToolResponseDto, user: AuthenticatedUser) {
    const message = await this.messageRepository.findOne({
      where: { toolCallId: payload.toolCallId }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const thread = await this.threadRepository.findOne({
      where: { id: message.thread as string, userId: user.id }
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    this.eventEmitter.emit('client_response', payload);
    return 'Tool response sent';
  }


  // For Agent
  async getThreadMessagesForAgent(threadId: string, payload: PaginatedQuery, agent: RegisteredAgent) {
    const { page, limit } = payload;

    const thread = await this.threadRepository.findOne({ where: { id: threadId, namespace: agent.namespace } });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { thread: threadId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data: messages.reverse(), total };
  }

  async updateThread(threadId: string, payload: UpdateThreadDto) {
    const { currentSessionId, isLocked } = payload;

    const thread = await this.threadRepository.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (currentSessionId !== undefined) thread.currentSessionId = currentSessionId;
    if (isLocked !== undefined) thread.isLocked = isLocked;

    await this.threadRepository.save(thread);
  }

  async createEmptyAgentMessage(threadId: string, sessionId: string, messageId: string) {
    const message = this.messageRepository.create({
      id: messageId,
      thread: threadId,
      content: '',
      role: 'agent',
      sessionId,
    });

    return this.messageRepository.save(message);
  }

  async updateAgentMessage(aguiEvent: AGUIEvent) {    
    const { threadId, sessionId, event } = aguiEvent;
    const { messageId } = event;
    const { toolCalls, content } = event.rawEvent || {};

    let message = await this.messageRepository.findOne({ where: { id: messageId, thread: threadId, role: 'agent' } });

    // Create a new message if it doesn't exist - Maybe the TEXT_MESSAGE_START event is not received
    if (!message) {
      message = this.messageRepository.create({
        id: messageId,
        thread: threadId,
        content: '',
        role: 'agent',
        sessionId,
      });

      await this.messageRepository.save(message);
    }

    if (toolCalls && toolCalls.length > 0) {
      console.log(toolCalls[0])
      message.toolInput = toolCalls[0].args;
      message.toolStatus = ToolStatus.Executing;
    }

    message.content = content;
    message.updatedAt = new Date();
  
    await this.messageRepository.save(message);
  }

  /***
   * Listen for TOOL_CALL_START and TOOL_CALL_RESULT events
   * TOOL_CALL_START: set status to "Calling"
   * TOOL_CALL_RESULT: set status to "Completed"
   **/ 
  async updateAgentMessageWithToolCall(aguiEvent: AGUIEvent) {
    const { threadId, event } = aguiEvent;
    const { content, toolCallId, toolCallName } = event;

    const message = await this.messageRepository.findOne({
      where: event.type === EventType.TOOL_CALL_RESULT 
        ? { toolCallId, thread: threadId, role: 'agent' }
        : { id: event.rawEvent.messageId, thread: threadId, role: 'agent' }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (event.type === EventType.TOOL_CALL_START) {
      message.toolStatus = ToolStatus.Calling;
      message.toolCallId = toolCallId;
      message.toolName = toolCallName;
    } else if (event.type === EventType.TOOL_CALL_RESULT) {
      message.toolResults = content;
      message.toolStatus = ToolStatus.Completed;
    }
    
    message.updatedAt = new Date();

    await this.messageRepository.save(message);
  }

  /**
   * Handle AGUI event processing (moved from SocketService)
   */
  @OnEvent('agui.event.process')
  async handleAGUIEventProcessing(payload: AGUIEvent) {
    const { threadId, sessionId, event } = payload;

    try {
      switch (event.type) {
        case EventType.RUN_STARTED:
          await this.handleRunStarted(threadId, sessionId);
          break;

        case EventType.RUN_FINISHED:
          await this.handleRunFinished(threadId, sessionId);
          break;

        case EventType.RUN_ERROR:
          await this.handleRunError(threadId, sessionId);
          break;

        case EventType.TEXT_MESSAGE_START:
          await this.handleTextMessageStart(threadId, sessionId, event.messageId);
          break;

        case EventType.TEXT_MESSAGE_END:
          await this.handleTextMessageEnd(payload);
          break;

        case EventType.TOOL_CALL_START:
          await this.handleToolCallStart(payload);
          break;

        case EventType.TOOL_CALL_RESULT:
          await this.handleToolCallResult(payload);
          break;

        default:
          this.logger.warn(`Unhandled AGUI event type: ${event.type}`);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing AGUI event ${event.type} for thread ${threadId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle RUN_STARTED event
   */
  private async handleRunStarted(threadId: string, sessionId: string): Promise<void> {
    await this.updateThread(threadId, { currentSessionId: sessionId });
  }

  /**
   * Handle RUN_FINISHED event
   */
  private async handleRunFinished(threadId: string, sessionId: string): Promise<void> {
    const redis = this.redisService.getOrThrow();
    await Promise.all([
      redis.del(`thread:${threadId}:${sessionId}`),
      this.updateThread(threadId, { currentSessionId: null, isLocked: false }),
    ]);
  }

  /**
   * Handle RUN_ERROR event
   */
  private async handleRunError(threadId: string, sessionId: string): Promise<void> {
    // TODO: add new error log to the thread for debugging
    const redis = this.redisService.getOrThrow();
    await Promise.all([
      redis.del(`thread:${threadId}:${sessionId}`),
      this.updateThread(threadId, { currentSessionId: null, isLocked: false }),
    ]);
  }

  /**
   * Handle TEXT_MESSAGE_START event
   */
  private async handleTextMessageStart(threadId: string, sessionId: string, messageId: string): Promise<void> {
    await this.createEmptyAgentMessage(threadId, sessionId, messageId);
  }

  /**
   * Handle TEXT_MESSAGE_END event
   */
  private async handleTextMessageEnd(payload: AGUIEvent): Promise<void> {
    await this.updateAgentMessage(payload);
  }

  /**
   * Handle TOOL_CALL_START event
   */
  private async handleToolCallStart(payload: AGUIEvent): Promise<void> {
    await this.updateAgentMessageWithToolCall(payload);
  }

  /**
   * Handle TOOL_CALL_RESULT event
   */
  private async handleToolCallResult(payload: AGUIEvent): Promise<void> {
    await this.updateAgentMessageWithToolCall(payload);
  }
}