import {  Module } from "@nestjs/common";
import { ThreadController } from "./thread.controller";
import { ThreadService } from "./thread.service";
import { TypeOrmModule } from "@nestjs/typeorm";

// Entities
import { Thread } from "src/entities/thread.entity";
import { Message } from "src/entities/message.entity";
import { RabbitMQModule } from "../rabbitmq/rabbitmq.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Thread, Message]),
    RabbitMQModule,
    AuthModule,
  ],
  controllers: [ThreadController],
  providers: [ThreadService],
  exports: [ThreadService],
})
export class ThreadModule {}