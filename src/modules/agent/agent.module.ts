import { Module } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { ThreadModule } from "../thread/thread.module";


@Module({
  imports: [ThreadModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}