import { Module } from "@nestjs/common";
import { SocketGateway } from "./socket.gateway";
import { ThreadModule } from "../thread/thread.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SocketService } from "./socket.service";

@Module({
  imports: [
    ThreadModule,
    EventEmitterModule.forRoot()
  ],
  providers: [SocketGateway, SocketService],
  exports: [SocketGateway],
})
export class SocketModule {}