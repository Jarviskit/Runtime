const { io } = require('socket.io-client');

/**
 * Test script to validate sequential AGUI event processing
 */

const SOCKET_URL = 'http://localhost:3000';
const TEST_THREAD_ID = 'test-thread-' + Date.now();
const TEST_SESSION_ID = 'test-session-' + Date.now();

// Create socket connection
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
});

// Test events in sequence
const testEvents = [
  {
    type: 'RUN_STARTED',
    messageId: 'msg-1',
    order: 1,
  },
  {
    type: 'TEXT_MESSAGE_START',
    messageId: 'msg-2',
    order: 2,
  },
  {
    type: 'TEXT_MESSAGE_END',
    messageId: 'msg-2',
    order: 3,
    rawEvent: {
      content: 'Hello, this is a test message',
    },
  },
  {
    type: 'TOOL_CALL_START',
    messageId: 'msg-3',
    order: 4,
    toolCallId: 'tool-call-1',
    toolCallName: 'test_tool',
  },
  {
    type: 'TOOL_CALL_RESULT',
    messageId: 'msg-3',
    order: 5,
    toolCallId: 'tool-call-1',
    content: 'Tool execution result',
  },
  {
    type: 'RUN_FINISHED',
    messageId: 'msg-4',
    order: 6,
  },
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🚀 Starting sequential processing test...');
  console.log(`Thread ID: ${TEST_THREAD_ID}`);
  console.log(`Session ID: ${TEST_SESSION_ID}`);

  // Listen for processed events
  socket.on('agui_event', (event) => {
    console.log(`✅ Received processed event: ${event.type} (order: ${event.order})`);
  });

  // Wait for connection
  await new Promise((resolve) => {
    socket.on('connect', resolve);
  });

  console.log('🔗 Connected to server');

  // Send events in rapid succession (intentionally out of order to test queuing)
  console.log('📤 Sending events in rapid succession...');
  
  // Send events 3, 1, 2, 4, 6, 5 to test ordering
  const shuffledEvents = [
    testEvents[2], // order 3
    testEvents[0], // order 1
    testEvents[1], // order 2
    testEvents[3], // order 4
    testEvents[5], // order 6
    testEvents[4], // order 5
  ];

  for (const event of shuffledEvents) {
    const aguiEvent = {
      threadId: TEST_THREAD_ID,
      sessionId: TEST_SESSION_ID,
      event,
      metadata: {},
      order: event.order,
    };

    console.log(`📤 Sending event: ${event.type} (order: ${event.order})`);
    socket.emit('agui_event', aguiEvent);
    
    // Small delay to avoid overwhelming the system
    await delay(10);
  }

  console.log('⏳ Waiting for events to be processed...');
  
  // Wait for processing
  await delay(5000);
  
  console.log('✅ Test completed!');
  console.log('Check the logs to verify that events were processed in order (1,2,3,4,5,6)');
  
  socket.disconnect();
  process.exit(0);
}

// Handle errors
socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  process.exit(1);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Start the test
runTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});