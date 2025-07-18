import { DataSource } from 'typeorm';
import { config } from './index.js';
import { MessageEntity } from '../entities/message.entity.js';
import { ThreadEntity } from '../entities/thread.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import { AgentEntity } from '../entities/agent.entity.js';
import { SessionEntity } from '../entities/session.entity.js';

export const AppDataSource = new DataSource({
  type: config.database.type,
  url: config.database.url,
  synchronize: config.database.synchronize,
  logging: config.database.logging,
  ssl: config.database.ssl,
  entities: [
    MessageEntity,
    ThreadEntity,
    UserEntity,
    AgentEntity,
    SessionEntity,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
});

export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connection initialized successfully');
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}