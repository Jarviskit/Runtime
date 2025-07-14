import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AgentService } from "./agent.service";
import { GetThreadMessagesDto } from "./dtos/get-thread-messages.dto";
import { AgentGuard } from "./agent.guard";
import { CurrentAgent } from "./current-agent.decorator";
import { RegisteredAgent } from "src/shared/interfaces";
import { MessageResponseDto } from "../thread/dtos/responses/message.dto";
import { Serialize } from "src/shared/decorators/serialize";


@Controller('agents')
@UseGuards(AgentGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('get-thread-messages')
  @Serialize(MessageResponseDto)
  getThreadMessages(@Query() payload: GetThreadMessagesDto, @CurrentAgent() agent: RegisteredAgent) {
    return this.agentService.getThreadMessages(payload, agent);
  }
}