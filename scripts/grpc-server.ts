import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { IChatMessage, IChatService, GRPC_SERVER_CONFIG } from './grpc-interfaces';

export class GrpcChatServer implements IChatService {
  private server: grpc.Server;
  private packageDefinition: protoLoader.PackageDefinition;
  private chatProto: any;

  constructor() {
    this.server = new grpc.Server();
    this.loadProtoDefinition();
    this.setupService();
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

  private setupService(): void {
    this.server.addService(this.chatProto.ChatService.service, {
      ChatStream: this.ChatStream.bind(this)
    });
  }

  ChatStream(call: grpc.ServerDuplexStream<IChatMessage, IChatMessage>): void {
    console.log(`[SERVER] New client connected`);

    call.on('data', (message: IChatMessage) => {
      console.log(`[SERVER] Received from ${message.user}: ${message.content}`);
      
      const response: IChatMessage = {
        user: 'Server',
        content: `Echo: ${message.content}`,
        timestamp: Math.floor(Date.now() / 1000),
      };
      
      call.write(response);
    });

    call.on('end', () => {
      console.log(`[SERVER] Client disconnected`);
      call.end();
    });

    call.on('error', (error: Error) => {
      console.error(`[SERVER] Stream error:`, error);
    });
  }

  async start(): Promise<void> {
    const serverUrl = `${GRPC_SERVER_CONFIG.host}:${GRPC_SERVER_CONFIG.port}`;
    
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        serverUrl,
        grpc.ServerCredentials.createInsecure(),
        (error: Error | null) => {
          if (error) {
            reject(error);
            return;
          }
          
          console.log(`[SERVER] gRPC server running at ${serverUrl}`);
          this.server.start();
          resolve();
        }
      );
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        console.log(`[SERVER] gRPC server stopped`);
        resolve();
      });
    });
  }
} 