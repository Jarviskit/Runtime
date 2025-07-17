export interface IChatMessage {
  user: string;
  content: string;
  timestamp: number;
}

export interface IChatService {
  ChatStream(call: any): void;
}

export interface IGrpcServerConfig {
  port: number;
  host: string;
}

export interface IGrpcClientConfig {
  serverUrl: string;
  credentials?: any;
}

export interface IGrpcStreamHandler {
  onData: (message: IChatMessage) => void;
  onError: (error: Error) => void;
  onEnd: () => void;
}

export const GRPC_SERVER_CONFIG: IGrpcServerConfig = {
  port: 50051,
  host: '0.0.0.0'
};

export const GRPC_CLIENT_CONFIG: IGrpcClientConfig = {
  serverUrl: 'localhost:50051'
}; 