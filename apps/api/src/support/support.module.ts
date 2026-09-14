import { Module } from '@nestjs/common';
import { SupportBotController } from './support-bot.controller.js';
import { SupportBotService } from './support-bot.service.js';

@Module({ controllers: [SupportBotController], providers: [SupportBotService] })
export class SupportModule {}
