# gRPC Bidirectional Streaming Demo

## 🎯 Tổng quan

Demo này triển khai một dịch vụ gRPC với **bidirectional streaming** sử dụng Node.js và TypeScript. Ví dụ mô phỏng một hệ thống chat đơn giản với khả năng gửi và nhận tin nhắn theo thời gian thực.

## 🏗️ Kiến trúc

### Thành phần chính

1. **GrpcChatServer** - Server gRPC xử lý bidirectional streaming
2. **GrpcChatClient** - Client gRPC kết nối với server
3. **ChatService** - Protobuf service definition
4. **Interfaces** - TypeScript interfaces cho type safety

### Tính năng

- ✅ **Bidirectional Streaming**: Cả client và server có thể gửi/nhận tin nhắn bất kỳ lúc nào
- ✅ **Multi-client Support**: Server có thể xử lý nhiều client đồng thời
- ✅ **Real-time Communication**: Tin nhắn được gửi/nhận ngay lập tức
- ✅ **Error Handling**: Xử lý lỗi và cleanup resources
- ✅ **TypeScript Support**: Type safety và modern JavaScript features

## 📁 Cấu trúc file

```
scripts/
├── chat.proto              # Protobuf service definition
├── grpc-interfaces.ts      # TypeScript interfaces
├── grpc-server.ts          # gRPC server implementation
├── grpc-client.ts          # gRPC client implementation
├── grpc_demo.ts            # Main demo script
└── run-grpc-demo.sh        # Shell script để chạy demo
```

## 🚀 Cách chạy

### 1. Cài đặt dependencies

```bash
npm install @grpc/grpc-js @grpc/proto-loader --legacy-peer-deps
```

### 2. Chạy demo

#### Single Client Demo (mặc định)
```bash
# Chạy demo với 1 client
./scripts/run-grpc-demo.sh

# Hoặc chạy trực tiếp
npx ts-node scripts/grpc_demo.ts
```

#### Multi-Client Demo
```bash
# Chạy demo với 3 client đồng thời
./scripts/run-grpc-demo.sh multi

# Hoặc chạy trực tiếp
npx ts-node scripts/grpc_demo.ts multi
```

### 3. Làm script có thể execute

```bash
chmod +x scripts/run-grpc-demo.sh
```

## 📋 Kết quả mong đợi

### Single Client Demo
```
🚀 Starting gRPC Bidirectional Streaming Demo...

✅ Server started successfully

[SERVER] gRPC server running at 0.0.0.0:50051
[CLIENT] Connected to server at localhost:50051
✅ Client connected successfully

📤 Sending messages to server...

[CLIENT] Sent: Hello from gRPC client #1
[SERVER] Received from DemoClient: Hello from gRPC client #1
📥 [CLIENT] Received from Server: Echo: Hello from gRPC client #1
[CLIENT] Sent: Hello from gRPC client #2
[SERVER] Received from DemoClient: Hello from gRPC client #2
📥 [CLIENT] Received from Server: Echo: Hello from gRPC client #2
...
```

### Multi-Client Demo
```
🚀 Starting Multi-Client gRPC Demo...

✅ Server started for multi-client demo

[SERVER] New client connected
[SERVER] New client connected
[SERVER] New client connected
[SERVER] Received from Client1: Message from Client1 #1
[SERVER] Received from Client2: Message from Client2 #1
[SERVER] Received from Client3: Message from Client3 #1
📥 [CLIENT-1] Received: Echo: Message from Client1 #1
📥 [CLIENT-2] Received: Echo: Message from Client2 #1
📥 [CLIENT-3] Received: Echo: Message from Client3 #1
...
```

## 🛠️ Customization

### Thay đổi cấu hình server

```typescript
// Trong grpc-interfaces.ts
export const GRPC_SERVER_CONFIG: IGrpcServerConfig = {
  port: 50051,  // Thay đổi port
  host: '0.0.0.0'  // Thay đổi host
};
```

### Thay đổi cấu hình client

```typescript
// Trong grpc-interfaces.ts
export const GRPC_CLIENT_CONFIG: IGrpcClientConfig = {
  serverUrl: 'localhost:50051'  // Thay đổi server URL
};
```

### Thêm tính năng mới

1. **Thêm message type**: Cập nhật `chat.proto` và interfaces
2. **Thêm authentication**: Implement credentials trong client/server
3. **Thêm message persistence**: Integrate với database
4. **Thêm load balancing**: Implement multiple server instances

## 🔧 Troubleshooting

### Lỗi thường gặp

1. **Port already in use**
   ```bash
   # Kiểm tra port đang sử dụng
   lsof -i :50051
   # Kill process nếu cần
   kill -9 <PID>
   ```

2. **Proto file not found**
   ```bash
   # Đảm bảo file chat.proto tồn tại
   ls -la scripts/chat.proto
   ```

3. **Dependencies not installed**
   ```bash
   # Reinstall dependencies
   npm install @grpc/grpc-js @grpc/proto-loader --legacy-peer-deps
   ```

### Debug mode

```bash
# Chạy với debug logs
DEBUG=* npx ts-node scripts/grpc_demo.ts
```

## 🔍 Technical Details

### Protobuf Definition
```protobuf
service ChatService {
  rpc ChatStream (stream ChatMessage) returns (stream ChatMessage);
}

message ChatMessage {
  string user = 1;
  string content = 2;
  int64 timestamp = 3;
}
```

### Stream Flow
```
Client ←→ Server
  |         |
  |  data   |
  |-------->|
  |         |
  |  echo   |
  |<--------|
  |         |
```

## 📚 Tài liệu tham khảo

- [gRPC Node.js Documentation](https://grpc.io/docs/languages/node/)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)
- [NestJS Microservices](https://docs.nestjs.com/microservices/grpc)

## 🤝 Contributing

Để mở rộng demo:
1. Fork repository
2. Tạo feature branch
3. Implement changes
4. Test thoroughly
5. Submit pull request

## 📝 License

MIT License - xem [LICENSE](../LICENSE) file để biết thêm chi tiết. 