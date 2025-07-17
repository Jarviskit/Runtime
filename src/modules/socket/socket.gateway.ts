import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { SocketService } from './socket.service';
import { AGUIEvent } from './interfaces';
import { Message } from 'src/entities/message.entity';
import { SendToolResponseDto } from '../thread/dtos/send-tool-response.dto';
import { GrpcService } from '../grpc/grpc.service';

@WebSocketGateway({
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  logger = new Logger('SocketGateway');

  constructor(
    private socketService: SocketService,
    private grpcService: GrpcService
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers['authorization'];
    // TODO: Implement auth logic here

    this.logger.warn(`[${client.id}] connected with token: [${token}]`);
  }

  handleDisconnect(client: Socket) {
    this.logger.warn(`Client disconnected: ${client.id}`);
  }

  /**
   * User events
   * TODO: Add auth logic for user here
   */
  @SubscribeMessage('join_thread')
  handleJoinThread(
    @MessageBody() data: { threadId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.warn(`Client ${client.id} joined thread: ${data.threadId}`);

    // Join the thread
    client.join(`thread:${data.threadId}`);

    // Emit to all clients in the thread that a new client has joined
    this.server.to(`thread:${data.threadId}`).emit('thread_joined', { threadId: data.threadId, clientId: client.id });
  }

  @SubscribeMessage('leave_thread')
  handleLeaveThread(
    @MessageBody() data: { threadId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.warn(`[${client.id}] left thread: ${data.threadId}`);

    // Leave the thread
    client.leave(`thread:${data.threadId}`);
  }

  @SubscribeMessage('send_message')
  handleSendMessage(
    @MessageBody() data: { threadId: string; message: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.warn(`[${client.id}] sent message to thread: ${data.threadId}`);

    // Emit to all clients in the thread that a new message has been sent
    this.server.to(`thread:${data.threadId}`).emit('message', data);
  }
  
  /**
   * Agent events - DEPRECATED: Use gRPC instead
   * Keeping for backward compatibility
   */
  @SubscribeMessage('agui_event')
  handleAGUIEvent(
    @MessageBody() data: AGUIEvent,
    @ConnectedSocket() client: Socket
  ) {
    this.logger.warn('DEPRECATED: agui_event via socket.io. Please use gRPC instead.');
    try {
      this.socketService.handleAGUIEvent(data, this.server);
    } catch (error) {
      this.logger.error(`Error handling AGUI event: ${error}`);
    }
  }

  @SubscribeMessage('join_agent_space')
  handleJoinAgentSpace(
    @MessageBody() data: { name: string; api_key: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.warn('DEPRECATED: join_agent_space via socket.io. Please use gRPC instead.');
    this.logger.warn(`[${client.id}] joined agent space: ${data.name} | API Key: ${data.api_key}`);

    client.join(`agent_space:${data.name}`);
  }

  // Local events
  @OnEvent('user.send_message')
  handleUserSendMessage(message: Message) {
    this.server.to(`thread:${message.thread}`).emit('message', message);
  }

  @OnEvent('agent.send_message')
  handleAgentSendMessage(message: Message) {
    this.server.to(`thread:${message.thread}`).emit('message', message);
  }

  @OnEvent('client_response')
  handleClientResponse(data: SendToolResponseDto) {
    // Send via socket.io for backward compatibility
    this.server.to(`agent_space:${data.namespace}`).emit('client_response', data);
    
    // Send via gRPC stream
    this.grpcService.sendClientResponse(data.namespace, {
      type: 'client_response',
      threadId: data.threadId || '',
      sessionId: data.sessionId || '',
      messageId: data.messageId || '',
      toolCallId: data.toolCallId || '',
      response: JSON.stringify(data.response || {}),
      error: data.error || '',
      metadata: {},
      timestamp: Date.now()
    });
  }

  // Handle gRPC events and emit to websocket clients
  @OnEvent('agui_event')
  handleGrpcAGUIEvent(data: { threadId: string; event: any }) {
    this.server.to(`thread:${data.threadId}`).emit('agui_event', data.event);
  }
}
