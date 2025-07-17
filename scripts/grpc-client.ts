import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { IChatMessage, IGrpcStreamHandler, GRPC_CLIENT_CONFIG } from './grpc-interfaces';

export class GrpcChatClient {
  private client: any;
  private packageDefinition: protoLoader.PackageDefinition;
  private chatProto: any;
  private stream: grpc.ClientDuplexStream<IChatMessage, IChatMessage> | null = null;

  constructor() {
    this.loadProtoDefinition();
    this.setupClient();
  }

  private loadProtoDefinition(): void {
    const PROTO_PATH = join(__dirname, 'chat.proto');
    this.packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.chatProto = grpc.loadPackageDefinition(this.packageDefinition).chat;
  }

  private setupClient(): void {
    this.client = new this.chatProto.ChatService(
      GRPC_CLIENT_CONFIG.serverUrl,
      grpc.credentials.createInsecure()
    );
  }

  connect(handler: IGrpcStreamHandler): void {
    this.stream = this.client.ChatStream();

    this.stream.on('data', (message: IChatMessage) => {
      handler.onData(message);
    });

    this.stream.on('error', (error: Error) => {
      handler.onError(error);
    });

    this.stream.on('end', () => {
      handler.onEnd();
    });

    console.log(`[CLIENT] Connected to server at ${GRPC_CLIENT_CONFIG.serverUrl}`);
  }

  sendMessage(message: IChatMessage): void {
    if (!this.stream) {
      throw new Error('Stream not connected. Call connect() first.');
    }

    this.stream.write(message);
    console.log(`[CLIENT] Sent: ${message.content}`);
  }

  disconnect(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
      console.log(`[CLIENT] Disconnected from server`);
    }
  }

  async sendMessagesWithInterval(params: {
    user: string;
    messagePrefix: string;
    count: number;
    intervalMs: number;
  }): Promise<void> {
    const { user, messagePrefix, count, intervalMs } = params;
    
    return new Promise((resolve) => {
      let messageCount = 0;
      
      const interval = setInterval(() => {
        messageCount++;
        
        const message: IChatMessage = {
          user,
          content: `${messagePrefix} #${messageCount}`,
          timestamp: Math.floor(Date.now() / 1000),
        };
        
        this.sendMessage(message);
        
        if (messageCount >= count) {
          clearInterval(interval);
          setTimeout(() => {
            this.disconnect();
            resolve();
          }, 1000);
        }
      }, intervalMs);
    });
  }
} 