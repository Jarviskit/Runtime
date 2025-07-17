import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

// Load the protobuf definition
const packageDefinition = protoLoader.loadSync(
  join(__dirname, '../proto/agent-runtime.proto'),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);

const agentRuntime = grpc.loadPackageDefinition(packageDefinition).agent_runtime as any;

// Create gRPC client
const client = new agentRuntime.AgentRuntimeService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Example: Send AGUI Event
async function sendAGUIEvent() {
  const request = {
    threadId: 'test-thread-123',
    sessionId: 'session-456',
    event: {
      type: 'TEXT_MESSAGE_START',
      messageId: 'msg-789',
      delta: 'Hello from gRPC!',
      content: '',
      toolCalls: [],
      metadata: {},
      timestamp: Date.now()
    },
    metadata: {
      agent: 'test-agent',
      version: '1.0.0'
    },
    order: 1
  };

  return new Promise((resolve, reject) => {
    client.SendAGUIEvent(request, (error: any, response: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

// Example: Join Agent Space (streaming)
async function joinAgentSpace() {
  const request = {
    name: 'test-agent-space',
    apiKey: 'test-api-key-123'
  };

  const stream = client.JoinAgentSpace(request);
  
  stream.on('data', (response: any) => {
    console.log('Received response:', response);
  });

  stream.on('error', (error: any) => {
    console.error('Stream error:', error);
  });

  stream.on('end', () => {
    console.log('Stream ended');
  });

  return stream;
}

// Example: Get Thread Messages
async function getThreadMessages() {
  const request = {
    threadId: 'test-thread-123',
    page: 1,
    limit: 10
  };

  return new Promise((resolve, reject) => {
    client.GetThreadMessages(request, (error: any, response: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

// Demo usage
async function demo() {
  try {
    console.log('Sending AGUI event...');
    const eventResponse = await sendAGUIEvent();
    console.log('Event response:', eventResponse);

    console.log('Joining agent space...');
    const stream = await joinAgentSpace();
    
    console.log('Getting thread messages...');
    const messages = await getThreadMessages();
    console.log('Messages:', messages);

    // Keep the stream alive for a bit
    setTimeout(() => {
      stream.cancel();
      console.log('Demo completed');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('Demo error:', error);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demo();
}