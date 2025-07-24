import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import globalConfig from './config/global';
import agentConfig from './config/agent-config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocketModule } from './modules/socket/socket.module';
import { ThreadModule } from './modules/thread/thread.module';
import { RabbitMQModule } from './modules/rabbitmq/rabbitmq.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { AuthModule } from './modules/auth/auth.module';
import { AgentModule } from './modules/agent/agent.module';
import { ApiLoggerMiddleware } from './shared/api-logger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.staging', '.env.development', '.env.local'],
      load: [globalConfig, agentConfig],
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('redis'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('database'),
      inject: [ConfigService],
    }),
    AuthModule,
    RabbitMQModule,
    ThreadModule,
    SocketModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiLoggerMiddleware).forRoutes('*');
  }
}
