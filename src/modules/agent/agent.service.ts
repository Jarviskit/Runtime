import { Injectable } from "@nestjs/common";
import { ThreadService } from "src/modules/thread/thread.service";
import { GetThreadMessagesDto } from "./dtos/get-thread-messages.dto";
import { RegisteredAgent } from "src/shared/interfaces";



@Injectable()
export class AgentService {
  constructor(private readonly threadService: ThreadService) {}

  getThreadMessages(payload: GetThreadMessagesDto, agent: RegisteredAgent) {
    return this.threadService.getThreadMessagesForAgent(payload.threadId, payload, agent);
  }
}