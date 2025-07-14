import { Message } from "src/entities/message.entity";

export interface MessageEvent {
  namespace: string;
  agentName: string;
  sentAt: string;
  message: Message;
  config: any;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
}

export interface RegisteredAgent {
  namespace: string;
  agentName: string;
}