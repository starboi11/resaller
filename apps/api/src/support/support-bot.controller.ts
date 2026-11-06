import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { SupportBotService, type TelegramUpdate } from './support-bot.service.js';

@Controller('support/telegram')
export class SupportBotController {
  constructor(@Inject(SupportBotService) private readonly support: SupportBotService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    this.support.verifySecret(secret);
    return this.support.receive(update);
  }
}
