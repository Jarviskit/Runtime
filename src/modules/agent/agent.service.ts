import { AppDataSource } from '../../config/database.js';
import { AgentEntity } from '../../entities/agent.entity.js';
import { getRabbitMQChannel } from '../../config/rabbitmq.js';

export interface CreateAgentData {
  name: string;
  namespace: string;
  description?: string;
  config?: Record<string, any>;
  tools?: string[];
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  tools?: string[];
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface AgentFilters {
  namespace?: string;
  isActive?: boolean;
  createdBy?: string;
}

export class AgentService {
  private agentRepository = AppDataSource.getRepository(AgentEntity);

  async getAgents(filters: AgentFilters = {}): Promise<AgentEntity[]> {
    const query = this.agentRepository.createQueryBuilder('agent');

    if (filters.namespace) {
      query.andWhere('agent.namespace = :namespace', { namespace: filters.namespace });
    }

    if (filters.isActive !== undefined) {
      query.andWhere('agent.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters.createdBy) {
      query.andWhere('agent.createdBy = :createdBy', { createdBy: filters.createdBy });
    }

    return query.orderBy('agent.createdAt', 'DESC').getMany();
  }

  async createAgent(data: CreateAgentData): Promise<AgentEntity> {
    // Check if agent with same name and namespace already exists
    const existingAgent = await this.agentRepository.findOne({
      where: {
        name: data.name,
        namespace: data.namespace,
      },
    });

    if (existingAgent) {
      throw new Error('Agent with this name already exists in the namespace');
    }

    const agent = this.agentRepository.create({
      id: this.generateId(),
      name: data.name,
      namespace: data.namespace,
      description: data.description,
      config: data.config,
      tools: data.tools || [],
      metadata: data.metadata,
      isActive: true,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedAgent = await this.agentRepository.save(agent);

    // Publish agent created event
    await this.publishAgentEvent('agent.created', savedAgent);

    return savedAgent;
  }

  async getAgentById(agentId: string, userId: string): Promise<AgentEntity> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId, createdBy: userId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    return agent;
  }

  async updateAgent(agentId: string, userId: string, data: UpdateAgentData): Promise<AgentEntity> {
    const agent = await this.getAgentById(agentId, userId);

    Object.assign(agent, {
      ...data,
      updatedAt: new Date(),
    });

    const updatedAgent = await this.agentRepository.save(agent);

    // Publish agent updated event
    await this.publishAgentEvent('agent.updated', updatedAgent);

    return updatedAgent;
  }

  async deleteAgent(agentId: string, userId: string): Promise<void> {
    const agent = await this.getAgentById(agentId, userId);

    await this.agentRepository.remove(agent);

    // Publish agent deleted event
    await this.publishAgentEvent('agent.deleted', { id: agentId, userId });
  }

  async getAgentsByNamespace(namespace: string, userId: string): Promise<AgentEntity[]> {
    return this.agentRepository.find({
      where: {
        namespace,
        createdBy: userId,
        isActive: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async executeAgent(agentId: string, userId: string, payload: any): Promise<any> {
    const agent = await this.getAgentById(agentId, userId);

    if (!agent.isActive) {
      throw new Error('Agent is not active');
    }

    // Publish agent execution event
    await this.publishAgentEvent('agent.execute', {
      agentId,
      userId,
      payload,
      timestamp: new Date().toISOString(),
    });

    // This is a placeholder - actual implementation would depend on your agent execution logic
    return {
      message: 'Agent execution initiated',
      agentId,
      executionId: this.generateId(),
    };
  }

  private async publishAgentEvent(eventType: string, data: any): Promise<void> {
    try {
      const channel = getRabbitMQChannel();
      await channel.publish('agent.events', eventType, Buffer.from(JSON.stringify(data)));
    } catch (error) {
      console.error('Error publishing agent event:', error);
    }
  }

  private generateId(): string {
    return 'agent_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}