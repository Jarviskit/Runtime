import { GrpcChatServer } from './grpc-server';
import { GrpcChatClient } from './grpc-client';
import { IChatMessage, IGrpcStreamHandler } from './grpc-interfaces';

class GrpcDemo {
  private server: GrpcChatServer;
  private client: GrpcChatClient;

  constructor() {
    this.server = new GrpcChatServer();
    this.client = new GrpcChatClient();
  }

  async runDemo(): Promise<void> {
    console.log('🚀 Starting gRPC Bidirectional Streaming Demo...\n');

    try {
      // Start server
      await this.server.start();
      console.log('✅ Server started successfully\n');

      // Wait a bit for server to be ready
      await this.delay(1000);

      // Setup client handlers
      const streamHandler: IGrpcStreamHandler = {
        onData: (message: IChatMessage) => {
          console.log(`📥 [CLIENT] Received from ${message.user}: ${message.content}`);
        },
        onError: (error: Error) => {
          console.error(`❌ [CLIENT] Stream error:`, error);
        },
        onEnd: () => {
          console.log(`🔌 [CLIENT] Stream ended`);
        }
      };

      // Connect client
      this.client.connect(streamHandler);
      console.log('✅ Client connected successfully\n');

      // Send messages with interval
      console.log('📤 Sending messages to server...\n');
      
      await this.client.sendMessagesWithInterval({
        user: 'DemoClient',
        messagePrefix: 'Hello from gRPC client',
        count: 5,
        intervalMs: 2000
      });

      console.log('\n✅ Demo completed successfully!');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up resources...');
    
    try {
      this.client.disconnect();
      await this.server.stop();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function runMultiClientDemo(): Promise<void> {
  console.log('🚀 Starting Multi-Client gRPC Demo...\n');
  
  const server = new GrpcChatServer();
  
  try {
    await server.start();
    console.log('✅ Server started for multi-client demo\n');
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create multiple clients
    const clientPromises = [];
    
    for (let i = 1; i <= 3; i++) {
      const client = new GrpcChatClient();
      
      const streamHandler: IGrpcStreamHandler = {
        onData: (message: IChatMessage) => {
          console.log(`📥 [CLIENT-${i}] Received: ${message.content}`);
        },
        onError: (error: Error) => {
          console.error(`❌ [CLIENT-${i}] Error:`, error);
        },
        onEnd: () => {
          console.log(`🔌 [CLIENT-${i}] Stream ended`);
        }
      };
      
      client.connect(streamHandler);
      
      const clientPromise = client.sendMessagesWithInterval({
        user: `Client${i}`,
        messagePrefix: `Message from Client${i}`,
        count: 3,
        intervalMs: 1500 + (i * 500) // Stagger timing
      });
      
      clientPromises.push(clientPromise);
    }
    
    // Wait for all clients to complete
    await Promise.all(clientPromises);
    
    console.log('\n✅ Multi-client demo completed!');
    
    // Wait a bit before stopping server
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await server.stop();
    
  } catch (error) {
    console.error('❌ Multi-client demo failed:', error);
    await server.stop();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const demoType = args[0] || 'single';
  
  console.log(`🎯 Running ${demoType} demo...\n`);
  
  if (demoType === 'multi') {
    await runMultiClientDemo();
  } else {
    const demo = new GrpcDemo();
    await demo.runDemo();
  }
  
  console.log('\n👋 Demo finished. Exiting...');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the demo
main().catch(console.error);
