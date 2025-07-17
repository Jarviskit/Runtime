# gRPC Migration Guide

## Overview

This document outlines the migration from Socket.IO to gRPC for agent communication in the JarvisKit Runtime. The gRPC implementation provides better scalability, type safety, and performance while maintaining sequential event processing per session.

## Key Features

### 1. **Scalability**
- gRPC uses HTTP/2 for multiplexing multiple requests over a single connection
- Built-in load balancing and connection pooling
- Better resource utilization compared to Socket.IO

### 2. **Sequential Event Processing**
- Each session has its own event queue to ensure events are processed in order
- Thread-safe implementation prevents race conditions
- Events within the same session are processed sequentially while different sessions can be processed in parallel

### 3. **Type Safety**
- Protocol Buffers provide strong typing for all messages
- Generated TypeScript interfaces ensure compile-time type checking
- Reduced runtime errors compared to JSON-based Socket.IO messages

### 4. **Backward Compatibility**
- Socket.IO WebSocket connections continue to work for existing clients
- gRPC events are forwarded to WebSocket clients automatically
- Gradual migration path available

## Architecture

```
Agent (gRPC Client) -> gRPC Server -> Event Queue -> Thread Service -> WebSocket Clients
                                   -> Redis Storage
```

### Components

1. **gRPC Service** (`src/modules/grpc/grpc.service.ts`)
   - Handles incoming gRPC requests
   - Manages session-based event queues
   - Provides streaming responses to agents

2. **gRPC Controller** (`src/modules/grpc/grpc.controller.ts`)
   - Implements the gRPC service interface
   - Routes requests to the service layer

3. **Event Queue System**
   - Per-session queues ensure sequential processing
   - Thread-safe implementation using Maps and Promises
   - Automatic cleanup of completed sessions

## API Reference

### Service Definition

```protobuf
service AgentRuntimeService {
  rpc SendAGUIEvent(AGUIEventRequest) returns (AGUIEventResponse);
  rpc JoinAgentSpace(JoinAgentSpaceRequest) returns (stream ClientResponse);
  rpc GetThreadMessages(GetThreadMessagesRequest) returns (GetThreadMessagesResponse);
}
```

### Methods

#### 1. SendAGUIEvent
Sends an AGUI event from agent to runtime.

**Request:**
```typescript
interface AGUIEventRequest {
  threadId: string;
  sessionId: string;
  event: BaseEvent;
  metadata: Record<string, string>;
  order: number;
}
```

**Response:**
```typescript
interface AGUIEventResponse {
  success: boolean;
  message: string;
  error: string;
}
```

#### 2. JoinAgentSpace (Streaming)
Establishes a bidirectional stream for agent communication.

**Request:**
```typescript
interface JoinAgentSpaceRequest {
  name: string;
  api_key: string;
}
```

**Response Stream:**
```typescript
interface ClientResponse {
  type: string;
  threadId: string;
  sessionId: string;
  messageId: string;
  toolCallId: string;
  response: string;
  error: string;
  metadata: Record<string, string>;
  timestamp: number;
}
```

#### 3. GetThreadMessages
Retrieves messages for a specific thread.

**Request:**
```typescript
interface GetThreadMessagesRequest {
  threadId: string;
  page: number;
  limit: number;
}
```

**Response:**
```typescript
interface GetThreadMessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
}
```

## Usage Examples

### Basic gRPC Client

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('proto/agent-runtime.proto');
const agentRuntime = grpc.loadPackageDefinition(packageDefinition).agent_runtime;

const client = new agentRuntime.AgentRuntimeService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Send event
const response = await client.SendAGUIEvent({
  threadId: 'thread-123',
  sessionId: 'session-456',
  event: {
    type: 'TEXT_MESSAGE_START',
    messageId: 'msg-789',
    delta: 'Hello World!'
  },
  order: 1
});
```

### Streaming Connection

```typescript
const stream = client.JoinAgentSpace({
  name: 'my-agent',
  apiKey: 'secret-key'
});

stream.on('data', (response) => {
  console.log('Received:', response);
});
```

## Migration Steps

### For Agents

1. **Install gRPC dependencies:**
   ```bash
   npm install @grpc/grpc-js @grpc/proto-loader
   ```

2. **Replace Socket.IO client with gRPC client:**
   ```typescript
   // Old Socket.IO way
   socket.emit('agui_event', eventData);
   
   // New gRPC way
   client.SendAGUIEvent(eventData);
   ```

3. **Update streaming logic:**
   ```typescript
   // Old Socket.IO way
   socket.on('client_response', handleResponse);
   
   // New gRPC way
   const stream = client.JoinAgentSpace(request);
   stream.on('data', handleResponse);
   ```

### For Runtime

The runtime automatically supports both protocols:
- Existing Socket.IO connections continue to work
- gRPC events are forwarded to WebSocket clients
- No changes needed for existing WebSocket clients

## Performance Benefits

1. **Reduced Memory Usage**: gRPC uses binary Protocol Buffers instead of JSON
2. **Better Compression**: HTTP/2 header compression reduces bandwidth
3. **Connection Multiplexing**: Multiple requests over single connection
4. **Type Safety**: Compile-time error detection
5. **Sequential Processing**: Guaranteed event ordering per session

## Configuration

### Environment Variables

```bash
# gRPC server port (default: 50051)
GRPC_PORT=50051

# gRPC server host (default: 0.0.0.0)
GRPC_HOST=0.0.0.0
```

### Server Configuration

The gRPC server is automatically started alongside the HTTP server in `main.ts`:

```typescript
const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.GRPC,
  options: {
    package: 'agent_runtime',
    protoPath: join(__dirname, '../proto/agent-runtime.proto'),
    url: '0.0.0.0:50051',
  },
});
```

## Monitoring and Debugging

### Logging

All gRPC operations are logged with appropriate log levels:
- `DEBUG`: Request/response details
- `WARN`: Deprecated Socket.IO usage
- `ERROR`: Processing errors

### Health Checks

The gRPC service includes basic health checking:
- Connection status monitoring
- Stream lifecycle management
- Automatic cleanup of disconnected clients

## Security Considerations

1. **Authentication**: Implement proper API key validation
2. **Authorization**: Validate agent permissions per thread
3. **Rate Limiting**: Implement request rate limiting
4. **TLS**: Use TLS in production environments

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check if gRPC server is running on port 50051
2. **Protocol Errors**: Ensure protobuf definitions match between client and server
3. **Stream Errors**: Handle stream disconnections gracefully
4. **Sequential Processing**: Events may appear delayed due to queue processing

### Debug Commands

```bash
# Check gRPC server status
grpc_health_probe -addr=localhost:50051

# Monitor gRPC traffic
grpcurl -plaintext localhost:50051 list

# Test connection
grpcurl -plaintext localhost:50051 agent_runtime.AgentRuntimeService/GetThreadMessages
```

## Future Enhancements

1. **Load Balancing**: Implement gRPC load balancing for multiple runtime instances
2. **Circuit Breaker**: Add circuit breaker pattern for resilience
3. **Metrics**: Integrate with Prometheus for monitoring
4. **Tracing**: Add distributed tracing support
5. **Authentication**: Implement JWT-based authentication