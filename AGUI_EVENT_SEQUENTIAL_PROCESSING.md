# AGUI Event Sequential Processing System

## Tổng quan

Hệ thống xử lý tuần tự các sự kiện AGUI từ agent đã được nâng cấp để đảm bảo các sự kiện được xử lý theo đúng thứ tự trong từng thread. Điều này giải quyết vấn đề race conditions và đảm bảo tính nhất quán dữ liệu.

## Kiến trúc

### 1. Luồng xử lý sự kiện

```
Agent -> WebSocket -> SocketGateway -> SocketService -> AGUIEventQueueService -> RabbitMQ -> Event Processor -> ThreadService
```

### 2. Các thành phần chính

#### AGUIEventQueueService (`src/modules/socket/agui-event-queue.service.ts`)
- **Mục đích**: Quản lý queue và xử lý tuần tự các sự kiện AGUI
- **Chức năng chính**:
  - Queue các sự kiện AGUI vào RabbitMQ
  - Đảm bảo chỉ một sự kiện được xử lý tại một thời điểm cho mỗi thread
  - Kiểm tra thứ tự sự kiện dựa trên field `order`
  - Xử lý lỗi và retry logic

#### Extended RabbitMQService (`src/modules/rabbitmq/rabbitmq.service.ts`)
- **Mục đích**: Mở rộng để hỗ trợ AGUI event queuing
- **Chức năng mới**:
  - `publishAGUIEvent()`: Publish sự kiện với thread-specific routing
  - `consumeAGUIEvents()`: Consume sự kiện với sequential processing
  - `createThreadQueue()`: Tạo queue riêng cho từng thread
  - `deleteThreadQueue()`: Xóa queue khi thread kết thúc

#### Updated ThreadService (`src/modules/thread/thread.service.ts`)
- **Mục đích**: Xử lý logic nghiệp vụ cho từng loại sự kiện
- **Chức năng mới**:
  - `@OnEvent('agui.event.process')`: Event listener cho sự kiện AGUI
  - Các handler riêng biệt cho từng loại sự kiện (RUN_STARTED, TEXT_MESSAGE_END, etc.)

## Cách thức hoạt động

### 1. Nhận sự kiện
```typescript
// SocketGateway nhận sự kiện từ agent
@SubscribeMessage('agui_event')
handleAGUIEvent(@MessageBody() data: AGUIEvent) {
  this.socketService.handleAGUIEvent(data, this.server);
}
```

### 2. Queue sự kiện
```typescript
// SocketService queue sự kiện thay vì xử lý trực tiếp
async handleAGUIEvent(payload: AGUIEvent, server: Server) {
  await this.aguiEventQueueService.queueAGUIEvent(payload, server);
}
```

### 3. Xử lý tuần tự
```typescript
// AGUIEventQueueService đảm bảo xử lý tuần tự
private async processAGUIEvent(queuedEvent: QueuedAGUIEvent) {
  // Kiểm tra thread đang được xử lý
  if (this.processingThreads.has(threadId)) {
    await this.requeueEvent(queuedEvent);
    return;
  }
  
  // Kiểm tra thứ tự sự kiện
  const shouldProcess = await this.shouldProcessEvent(event);
  if (!shouldProcess) {
    await this.requeueEvent(queuedEvent);
    return;
  }
  
  // Xử lý sự kiện
  await this.handleAGUIEvent(event, server);
}
```

### 4. Xử lý nghiệp vụ
```typescript
// ThreadService xử lý logic nghiệp vụ
@OnEvent('agui.event.process')
async handleAGUIEventProcessing(payload: AGUIEvent) {
  switch (payload.event.type) {
    case EventType.RUN_STARTED:
      await this.handleRunStarted(threadId, sessionId);
      break;
    // ... other event types
  }
}
```

## Đặc điểm kỹ thuật

### 1. Đảm bảo thứ tự (Order Guarantee)
- Sử dụng field `order` trong AGUIEvent
- Lưu trữ `last_processed_order` trong Redis
- Chỉ xử lý sự kiện có order = last_processed_order + 1

### 2. Xử lý tuần tự per Thread
- Sử dụng Set `processingThreads` để track threads đang xử lý
- Mỗi thread chỉ có một sự kiện được xử lý tại một thời điểm
- Các thread khác nhau có thể xử lý song song

### 3. RabbitMQ Configuration
```typescript
// Exchange cho AGUI events
await this.channel.assertExchange('agui_events', 'topic', { durable: true });

// Queue với TTL và max length
await this.channel.assertQueue(queueName, { 
  durable: true,
  arguments: {
    'x-message-ttl': 60000, // 1 minute TTL
    'x-max-retries': 3,
  }
});

// Routing key: thread.{threadId}
const routingKey = `thread.${threadId}`;
```

### 4. Error Handling
- Retry logic với exponential backoff
- Dead letter queue cho failed events
- Logging chi tiết cho debugging
- Graceful degradation

## Cấu hình

### Environment Variables
```bash
# RabbitMQ connection
JARVIS_KIT_RABBITMQ_URI=amqp://localhost:5672

# Redis connection (đã có sẵn)
REDIS_URL=redis://localhost:6379
```

### RabbitMQ Queues
- **Main Queue**: `agui_events_queue`
- **Thread-specific Queues**: `agui_events_queue:{threadId}`
- **Exchange**: `agui_events` (topic)
- **Routing Pattern**: `thread.*`

## Monitoring

### 1. Queue Statistics
```typescript
// Kiểm tra trạng thái queue
const stats = await rabbitmqService.getQueueStats('agui_events_queue');
console.log(`Messages: ${stats.messageCount}, Consumers: ${stats.consumerCount}`);
```

### 2. Redis Keys
- `thread:{threadId}:last_processed_order` - Thứ tự sự kiện đã xử lý
- `thread:{threadId}:{sessionId}` - Session data (đã có sẵn)

### 3. Logs
```
[AGUIEventQueueService] Queued AGUI event for thread {threadId}, session {sessionId}, order {order}
[AGUIEventQueueService] Processed AGUI event for thread {threadId}, session {sessionId}, order {order}
[ThreadService] Error processing AGUI event {eventType} for thread {threadId}: {error}
```

## Cách sử dụng

### 1. Khởi động hệ thống
```bash
# Đảm bảo RabbitMQ và Redis đang chạy
npm run start:dev
```

### 2. Gửi sự kiện từ agent
```typescript
// Agent gửi sự kiện qua WebSocket
socket.emit('agui_event', {
  threadId: 'thread-123',
  sessionId: 'session-456',
  event: {
    type: 'TEXT_MESSAGE_END',
    messageId: 'msg-789',
    // ... other event data
  },
  order: 5, // Thứ tự sự kiện
  metadata: {}
});
```

### 3. Theo dõi xử lý
```typescript
// Client nhận sự kiện đã xử lý
socket.on('agui_event', (event) => {
  console.log(`Received processed event: ${event.type}, order: ${event.order}`);
});
```

## Lợi ích

1. **Đảm bảo thứ tự**: Sự kiện được xử lý theo đúng thứ tự
2. **Tránh race conditions**: Chỉ một sự kiện được xử lý tại một thời điểm per thread
3. **Scalability**: Có thể scale horizontal bằng cách thêm consumers
4. **Reliability**: RabbitMQ đảm bảo message delivery
5. **Monitoring**: Có thể monitor queue depth và processing rate
6. **Error handling**: Robust error handling và retry logic

## Tương lai

### Những cải tiến có thể thêm:
1. **Dead Letter Queue**: Cho các sự kiện failed sau nhiều retry
2. **Metrics**: Prometheus metrics cho monitoring
3. **Admin Interface**: Web interface để quản lý queues
4. **Auto-scaling**: Tự động scale consumers dựa trên queue depth
5. **Event Sourcing**: Lưu trữ tất cả events để replay nếu cần

## Troubleshooting

### 1. Sự kiện bị stuck
```bash
# Kiểm tra queue depth
docker exec rabbitmq rabbitmqctl list_queues

# Kiểm tra consumers
docker exec rabbitmq rabbitmqctl list_consumers
```

### 2. Thứ tự sự kiện sai
```bash
# Kiểm tra last_processed_order trong Redis
redis-cli get "thread:thread-123:last_processed_order"
```

### 3. Performance issues
```bash
# Kiểm tra RabbitMQ memory usage
docker exec rabbitmq rabbitmqctl status
```