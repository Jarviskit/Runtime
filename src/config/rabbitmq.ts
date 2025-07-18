import amqp, { Connection, Channel } from 'amqplib';
import { config } from './index.js';

export let rabbitmqConnection: Connection;
export let rabbitmqChannel: Channel;

export async function initializeRabbitMQ(): Promise<void> {
  try {
    rabbitmqConnection = await amqp.connect(config.rabbitmq.url);
    rabbitmqChannel = await rabbitmqConnection.createChannel();
    
    // Setup exchanges and queues
    await setupQueues();
    
    console.log('RabbitMQ connection initialized successfully');
  } catch (error) {
    console.error('Error during RabbitMQ initialization:', error);
    throw error;
  }
}

async function setupQueues(): Promise<void> {
  // Agent processing queue
  await rabbitmqChannel.assertExchange('agent.events', 'topic', { durable: true });
  await rabbitmqChannel.assertQueue('agent.processing', { durable: true });
  await rabbitmqChannel.bindQueue('agent.processing', 'agent.events', 'agent.process');
  
  // Thread events queue
  await rabbitmqChannel.assertExchange('thread.events', 'topic', { durable: true });
  await rabbitmqChannel.assertQueue('thread.updates', { durable: true });
  await rabbitmqChannel.bindQueue('thread.updates', 'thread.events', 'thread.*');
  
  // Message events queue
  await rabbitmqChannel.assertExchange('message.events', 'topic', { durable: true });
  await rabbitmqChannel.assertQueue('message.processing', { durable: true });
  await rabbitmqChannel.bindQueue('message.processing', 'message.events', 'message.*');
}

export function getRabbitMQChannel(): Channel {
  if (!rabbitmqChannel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return rabbitmqChannel;
}

export function getRabbitMQConnection(): Connection {
  if (!rabbitmqConnection) {
    throw new Error('RabbitMQ connection not initialized');
  }
  return rabbitmqConnection;
}