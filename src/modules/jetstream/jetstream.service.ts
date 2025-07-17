import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { 
  connect, 
  NatsConnection, 
  JetStreamManager, 
  JetStreamClient, 
  StreamConfig,
  ConsumerConfig,
  JsMsg,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
} from 'nats';
import { ThreadEvent, ThreadEventType } from './interfaces/thread-event.interface';

@Injectable()
export class JetStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JetStreamService.name);
  private nc: NatsConnection;
  private jsm: JetStreamManager;
  private js: JetStreamClient;
  
  private readonly STREAM_NAME = 'JARVISKIT_STREAM';
  private readonly THREAD_SUBJECT_PREFIX = 'jarviskit_stream.thread';

  async onModuleInit() {
    try {
      await this.connect();
      await this.setupStream();
      this.logger.log('JetStream service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize JetStream service', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.close();
      this.logger.log('JetStream connection closed');
    }
  }

  private async connect() {
    this.nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
    });

    this.jsm = await this.nc.jetstreamManager();
    this.js = this.nc.jetstream();

    this.logger.log('Connected to NATS JetStream');
  }

  private async setupStream() {
    const streamConfig: Partial<StreamConfig> = {
      name: this.STREAM_NAME,
      subjects: [`${this.THREAD_SUBJECT_PREFIX}.*`],
      retention: 'workqueue',
      storage: 'file',
      max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
      max_msgs: 1000000,
      duplicate_window: 2 * 60 * 1000000000, // 2 minutes in nanoseconds
    };

    try {
      await this.jsm.streams.add(streamConfig);
      this.logger.log(`Stream ${this.STREAM_NAME} created successfully`);
    } catch (error) {
      if (error.message.includes('stream name already in use')) {
        this.logger.log(`Stream ${this.STREAM_NAME} already exists`);
      } else {
        this.logger.error('Failed to create stream', error);
        throw error;
      }
    }
  }

  async publishThreadEvent(threadId: string, event: ThreadEvent): Promise<void> {
    const subject = `${this.THREAD_SUBJECT_PREFIX}.${threadId}`;
    const message = JSON.stringify(event);

    try {
      const ack = await this.js.publish(subject, new TextEncoder().encode(message), {
        msgID: `${event.runId}-${event.type}-${Date.now()}`,
      });
      
      this.logger.debug(`Published event ${event.type} for thread ${threadId}, sequence: ${ack.seq}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type} for thread ${threadId}`, error);
      throw error;
    }
  }

  async createConsumer(
    threadId: string, 
    consumerName: string, 
    startSequence?: number
  ): Promise<void> {
    const subject = `${this.THREAD_SUBJECT_PREFIX}.${threadId}`;
    
    const consumerConfig: Partial<ConsumerConfig> = {
      name: consumerName,
      filter_subject: subject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: startSequence ? DeliverPolicy.ByStartSequence : DeliverPolicy.All,
      opt_start_seq: startSequence,
      replay_policy: ReplayPolicy.Instant,
      max_deliver: 3,
      ack_wait: 30 * 1000000000, // 30 seconds in nanoseconds
    };

    try {
      await this.jsm.consumers.add(this.STREAM_NAME, consumerConfig);
      this.logger.log(`Consumer ${consumerName} created for thread ${threadId}`);
    } catch (error) {
      if (error.message.includes('consumer name already in use')) {
        this.logger.log(`Consumer ${consumerName} already exists`);
      } else {
        this.logger.error(`Failed to create consumer ${consumerName}`, error);
        throw error;
      }
    }
  }

  async subscribe(
    consumerName: string,
    callback: (event: ThreadEvent, msg: JsMsg) => Promise<void>
  ): Promise<void> {
    try {
      const consumer = await this.js.consumers.get(this.STREAM_NAME, consumerName);
      const messages = await consumer.consume();

      for await (const msg of messages) {
        try {
          const eventData = JSON.parse(new TextDecoder().decode(msg.data));
          eventData.sequenceId = msg.seq;
          
          await callback(eventData, msg);
          msg.ack();
        } catch (error) {
          this.logger.error(`Error processing message in consumer ${consumerName}`, error);
          msg.nak();
        }
      }
    } catch (error) {
      this.logger.error(`Failed to subscribe to consumer ${consumerName}`, error);
      throw error;
    }
  }

  async deleteConsumer(consumerName: string): Promise<void> {
    try {
      await this.jsm.consumers.delete(this.STREAM_NAME, consumerName);
      this.logger.log(`Consumer ${consumerName} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete consumer ${consumerName}`, error);
    }
  }

  async getAllThreadEvents(threadId: string): Promise<ThreadEvent[]> {
    const subject = `${this.THREAD_SUBJECT_PREFIX}.${threadId}`;
    const events: ThreadEvent[] = [];

    try {
      const stream = await this.jsm.streams.get(this.STREAM_NAME);
      const messages = await stream.getMessage({ subject });
      
      // This is a simplified version - in reality, you'd need to iterate through all messages
      // For now, we'll return empty array as this is primarily used for debugging
      return events;
    } catch (error) {
      this.logger.error(`Failed to get events for thread ${threadId}`, error);
      return [];
    }
  }

  getConnection(): NatsConnection {
    return this.nc;
  }

  getJetStream(): JetStreamClient {
    return this.js;
  }

  getJetStreamManager(): JetStreamManager {
    return this.jsm;
  }
}