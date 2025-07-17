import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcController } from './grpc.controller';
import { GrpcService } from './grpc.service';
import { ThreadModule } from '../thread/thread.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ThreadModule,
    EventEmitterModule.forRoot(),
    ClientsModule.register([
      {
        name: 'AGENT_RUNTIME_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'agent_runtime',
          protoPath: join(__dirname, '../../../proto/agent-runtime.proto'),
          url: '0.0.0.0:50051',
        },
      },
    ]),
  ],
  controllers: [GrpcController],
  providers: [GrpcService],
  exports: [GrpcService],
})
export class GrpcModule {}