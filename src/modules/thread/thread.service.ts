import { AppDataSource } from '../../config/database.js';
import { ThreadEntity } from '../../entities/thread.entity.js';
import { MessageEntity } from '../../entities/message.entity.js';
import { ThreadMode } from '../../shared/enum.js';
import { getRabbitMQChannel } from '../../config/rabbitmq.js';

export interface CreateThreadData {
  userId: string;
  namespace: string;
  agentName: string;
  name?: string;
  mode?: ThreadMode;
  metadata?: Record<string, any>;
}

export interface UpdateThreadData {
  name?: string;
  mode?: ThreadMode;
  metadata?: Record<string, any>;
  isLocked?: boolean;
}

export interface SendMessageData {
  content: string;
  role?: string;
  metadata?: Record<string, any>;
}

export class ThreadService {
  private threadRepository = AppDataSource.getRepository(ThreadEntity);
  private messageRepository = AppDataSource.getRepository(MessageEntity);

  async getThreadsByUser(userId: string, filters: { namespace?: string; agentName?: string } = {}): Promise<ThreadEntity[]> {
    const query = this.threadRepository.createQueryBuilder('thread')
      .where('thread.userId = :userId', { userId });

    if (filters.namespace) {
      query.andWhere('thread.namespace = :namespace', { namespace: filters.namespace });
    }

    if (filters.agentName) {
      query.andWhere('thread.agentName = :agentName', { agentName: filters.agentName });
    }

    return query.orderBy('thread.lastMessageAt', 'DESC').getMany();
  }

  async createThread(data: CreateThreadData): Promise<ThreadEntity> {
    const thread = this.threadRepository.create({
      id: this.generateId(),
      userId: data.userId,
      namespace: data.namespace,
      agentName: data.agentName,
      name: data.name,
      mode: data.mode || ThreadMode.MANUAL,
      metadata: data.metadata,
      numOfMessages: 0,
      isLocked: false,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    });

    const savedThread = await this.threadRepository.save(thread);

    // Publish thread created event
    await this.publishThreadEvent('thread.created', savedThread);

    return savedThread;
  }

  async getThreadById(threadId: string, userId: string): Promise<ThreadEntity> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, userId },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    return thread;
  }

  async updateThread(threadId: string, userId: string, data: UpdateThreadData): Promise<ThreadEntity> {
    const thread = await this.getThreadById(threadId, userId);

    Object.assign(thread, {
      ...data,
      updatedAt: new Date(),
    });

    const updatedThread = await this.threadRepository.save(thread);

    // Publish thread updated event
    await this.publishThreadEvent('thread.updated', updatedThread);

    return updatedThread;
  }

  async deleteThread(threadId: string, userId: string): Promise<void> {
    const thread = await this.getThreadById(threadId, userId);

    // Delete all messages in the thread
    await this.messageRepository.delete({ thread: threadId });

    // Delete the thread
    await this.threadRepository.remove(thread);

    // Publish thread deleted event
    await this.publishThreadEvent('thread.deleted', { id: threadId, userId });
  }

  async getMessages(threadId: string, userId: string, options: { limit?: number; offset?: number } = {}): Promise<MessageEntity[]> {
    // Verify user has access to thread
    await this.getThreadById(threadId, userId);

    const query = this.messageRepository.createQueryBuilder('message')
      .where('message.thread = :threadId', { threadId })
      .orderBy('message.createdAt', 'ASC');

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.offset) {
      query.offset(options.offset);
    }

    return query.getMany();
  }

  async sendMessage(threadId: string, userId: string, data: SendMessageData): Promise<MessageEntity> {
    const thread = await this.getThreadById(threadId, userId);

    if (thread.isLocked) {
      throw new Error('Thread is locked');
    }

    const message = this.messageRepository.create({
      id: this.generateId(),
      thread: threadId,
      content: data.content,
      role: data.role || 'user',
      metadata: data.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update thread
    thread.numOfMessages += 1;
    thread.lastMessageAt = new Date();
    await this.threadRepository.save(thread);

    // Publish message created event
    await this.publishMessageEvent('message.created', savedMessage);

    return savedMessage;
  }

  private async publishThreadEvent(eventType: string, data: any): Promise<void> {
    try {
      const channel = getRabbitMQChannel();
      await channel.publish('thread.events', eventType, Buffer.from(JSON.stringify(data)));
    } catch (error) {
      console.error('Error publishing thread event:', error);
    }
  }

  private async publishMessageEvent(eventType: string, data: any): Promise<void> {
    try {
      const channel = getRabbitMQChannel();
      await channel.publish('message.events', eventType, Buffer.from(JSON.stringify(data)));
    } catch (error) {
      console.error('Error publishing message event:', error);
    }
  }

  private generateId(): string {
    return 'thread_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}