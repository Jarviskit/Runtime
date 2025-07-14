import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ThreadService } from "./thread.service";

import { AddUserMessageDto } from "./dtos/add-user-message.dto";
import { CreateThreadDto } from "./dtos/create-thread.dto";
import { Serialize } from "src/shared/decorators/serialize";
import { ThreadResponseDto } from "./dtos/responses/thread.dto";
import { Thread } from "src/entities/thread.entity";
import { PaginatedQuery } from "src/shared/dto";
import { MessageResponseDto } from "./dtos/responses/message.dto";
import { FindThreadDto } from "./dtos/find-thread.dto";
import { SendToolResponseDto } from "./dtos/send-tool-response.dto";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedUser } from "src/shared/interfaces";
import { CurrentUser } from "../auth/current-user.decorator";


@Controller('threads')
@UseGuards(AuthGuard)
export class ThreadController {
  constructor(
    private readonly threadService: ThreadService,
  ) {}

  @Get()
  @Serialize(ThreadResponseDto)
  findAll(@Query() payload: FindThreadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.getThreads(payload, user);
  }

  @Post()
  create(@Body() payload: CreateThreadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.createThread(payload, user);
  }

  @Get(':id')
  @Serialize(Thread)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.getThreadById(id, user);
  }

  @Get(':id/messages')
  @Serialize(MessageResponseDto)  
  findMessages(@Param('id') id: string, @Query() payload: PaginatedQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.getThreadMessages(id, payload, user);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() payload: AddUserMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.sendUserMessage(id, payload, user);
  }

  @Get(':id/sessions/:sessionId/events')
  getCachedEvents(@Param('id') id: string, @Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.getCachedEvents(id, sessionId, user);
  }

  @Post('send-tool-response')
  async sendToolResponse(@Body() payload: SendToolResponseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.threadService.sendClientResponse(payload, user);
  }
}