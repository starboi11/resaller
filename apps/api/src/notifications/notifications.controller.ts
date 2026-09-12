import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type AuthenticatedUser, SessionGuard } from '../auth/session.guard.js';
import { NotificationEndpointDto, NotificationPreferenceDto } from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}
  @Get() list(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.notifications.list(request.user.id); }
  @Get('unread-count') count(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.notifications.unreadCount(request.user.id); }
  @Patch(':id/read') read(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('id') id: string) { return this.notifications.markRead(request.user.id, id); }
  @Post('read-all') readAll(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.notifications.markAllRead(request.user.id); }
  @Get('preferences') preferences(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.notifications.preferences(request.user.id); }
  @Post('preferences') preference(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Body() input: NotificationPreferenceDto) { return this.notifications.preference(request.user.id, input.channel, input.eventType, input.enabled); }
  @Get('endpoints') endpoints(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.notifications.endpoints(request.user.id); }
  @Post('endpoints') addEndpoint(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Body() input: NotificationEndpointDto) { return this.notifications.addEndpoint(request.user.id, input.channel, input.value); }
  @Delete('endpoints/:id') removeEndpoint(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('id') id: string) { return this.notifications.removeEndpoint(request.user.id, id); }
}
