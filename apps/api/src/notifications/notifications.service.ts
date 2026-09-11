import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';

const CRITICAL_EVENTS = new Set(['ORDER_ACTION_REQUIRED', 'SECURITY_ALERT', 'ACCOUNT_RESTRICTED']);

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, take: 100, orderBy: { createdAt: 'desc' } });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: notification.readAt ?? new Date() } });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  }

  preferences(userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { userId }, orderBy: [{ channel: 'asc' }, { eventType: 'asc' }] });
  }

  preference(userId: string, channel: string, eventType: string, enabled: boolean) {
    if (!enabled && CRITICAL_EVENTS.has(eventType)) throw new BadRequestException('Critical notifications cannot be disabled');
    return this.prisma.notificationPreference.upsert({ where: { userId_channel_eventType: { userId, channel, eventType } }, create: { userId, channel, eventType, enabled }, update: { enabled } });
  }
}
