# JarvisKit Runtime - Hono + Bun Stack

A modern, high-performance runtime for JarvisKit built with Hono, Bun, TypeORM, WebSocket, and RabbitMQ.

## 🚀 Technology Stack

### Base Layer
- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Framework**: Hono (Fast web framework)
- **Database ORM**: TypeORM
- **Language**: TypeScript with ES Modules

### Protocols & Transports
- **HTTP API**: Hono with Zod validation
- **WebSocket**: Native WebSocket with custom protocol
- **Message Queue**: RabbitMQ (AMQP)
- **Cache**: Redis

### Architecture Components
- **Entities**: User, Agent, Thread, Session, Message
- **Services**: Modular service architecture
- **Middleware**: Authentication, validation, logging
- **Configuration**: Environment-based configuration

## 🛠️ Installation

### Prerequisites
- Bun >= 1.0.0
- PostgreSQL >= 13
- Redis >= 6.0
- RabbitMQ >= 3.9

### Setup

1. **Install dependencies**:
```bash
bun install
```

2. **Environment Configuration**:
Create a `.env` file:
```env
PORT=6789
NODE_ENV=development

# Database
JARVIS_KIT_POSTGRES_URI=postgresql://username:password@localhost:5432/jarviskit

# Redis
JARVIS_KIT_REDIS_URI=redis://localhost:6379

# RabbitMQ
JARVIS_KIT_RABBITMQ_URI=amqp://localhost:5672

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# WebSocket
WEBSOCKET_CORS_ORIGIN=*
```

3. **Database Setup**:
```bash
# Create database
createdb jarviskit

# Database will be auto-synchronized on first run
```

4. **Start Services**:
```bash
# Start Redis
redis-server

# Start RabbitMQ
rabbitmq-server

# Start PostgreSQL
pg_ctl start
```

## 🚀 Running the Application

### Development Mode
```bash
bun run dev
```

### Production Mode
```bash
# Build
bun run build

# Start
bun run start:prod
```

### Available Scripts
- `bun run dev` - Start development server with hot reload
- `bun run build` - Build the application
- `bun run start` - Start production server
- `bun run format` - Format code with Prettier
- `bun run lint` - Lint code with ESLint
- `bun run test` - Run tests
- `bun run typecheck` - Type check with TypeScript

## 📚 API Documentation

The API documentation is available at: `http://localhost:6789/docs`

### Authentication
All protected endpoints require a Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

### WebSocket Connection
Connect to WebSocket at: `ws://localhost:6789/ws`

WebSocket Protocol:
```javascript
// Authentication
{
  "type": "auth",
  "data": { "token": "your-jwt-token" }
}

// Join thread
{
  "type": "join_thread",
  "data": { "threadId": "thread-id" }
}

// Ping/Pong
{
  "type": "ping",
  "data": {}
}
```

## 🏗️ Architecture

### Directory Structure
```
src/
├── config/           # Configuration files
│   ├── index.ts      # Main config
│   ├── database.ts   # TypeORM configuration
│   ├── redis.ts      # Redis configuration
│   └── rabbitmq.ts   # RabbitMQ configuration
├── entities/         # Database entities
│   ├── user.entity.ts
│   ├── agent.entity.ts
│   ├── thread.entity.ts
│   ├── session.entity.ts
│   └── message.entity.ts
├── modules/          # Feature modules
│   ├── auth/         # Authentication module
│   ├── thread/       # Thread management
│   └── agent/        # Agent management
├── shared/           # Shared utilities
│   ├── middleware/   # Custom middleware
│   └── enum.ts       # Enums and constants
├── transports/       # Transport layers
│   └── websocket.ts  # WebSocket server
└── main.ts          # Application entry point
```

### Key Features

1. **High Performance**: Built with Bun for maximum performance
2. **Type Safety**: Full TypeScript support with strict typing
3. **Modern Architecture**: Clean separation of concerns
4. **Real-time Communication**: WebSocket support for live updates
5. **Message Queue**: RabbitMQ for reliable event processing
6. **Caching**: Redis for high-performance caching
7. **Database**: PostgreSQL with TypeORM for robust data management

### Migration from NestJS

This branch represents a complete migration from the previous NestJS-based architecture to a modern Hono + Bun stack. Key improvements include:

- **Performance**: Significantly faster startup and runtime performance
- **Simplicity**: Reduced complexity and boilerplate code
- **Modern Standards**: ES Modules, modern TypeScript features
- **Lightweight**: Smaller bundle size and memory footprint

## 🔧 Development

### Adding New Features

1. **Create Entity**: Add new entity in `src/entities/`
2. **Create Service**: Add business logic in `src/modules/[module]/[module].service.ts`
3. **Create Routes**: Add HTTP routes in `src/modules/[module]/[module].routes.ts`
4. **Update Main**: Register routes in `src/main.ts`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `6789` |
| `NODE_ENV` | Environment mode | `development` |
| `JARVIS_KIT_POSTGRES_URI` | PostgreSQL connection string | Required |
| `JARVIS_KIT_REDIS_URI` | Redis connection string | Required |
| `JARVIS_KIT_RABBITMQ_URI` | RabbitMQ connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` |

## 🚨 Migration Notes

This branch contains a complete rewrite of the application using modern technologies. The migration includes:

- ✅ HTTP API endpoints (Hono)
- ✅ Database integration (TypeORM)
- ✅ Authentication system (JWT)
- ✅ WebSocket support (Native WebSocket)
- ✅ Message queue (RabbitMQ)
- ✅ Caching (Redis)
- ✅ Configuration management
- ✅ Entity definitions
- ✅ Service layer architecture

### Breaking Changes

- API responses now use a consistent `{ success: boolean, data?: any, error?: string }` format
- WebSocket protocol has been simplified
- Database schema may require migration (auto-sync enabled in development)
- Environment variables have been updated

## 📝 License

MIT License - see LICENSE file for details.
