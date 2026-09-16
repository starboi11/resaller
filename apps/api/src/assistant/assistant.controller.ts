import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { AssistantRequestDto } from './assistant.dto.js';
import { AssistantService } from './assistant.service.js';

@Controller('assistant')
@UseGuards(SessionGuard)
export class AssistantController {
  constructor(
    @Inject(AssistantService) private readonly assistant: AssistantService,
  ) {}

  @Post('message')
  message(
    @Req() request: FastifyRequest & { user: AuthenticatedUser },
    @Body() input: AssistantRequestDto,
  ) {
    return this.assistant.answer(request.user, input);
  }
}
