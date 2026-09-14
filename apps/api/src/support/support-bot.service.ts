import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TelegramChat = { id: number; type: string };
type TelegramMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  chat: TelegramChat;
  reply_to_message?: { message_id: number };
};
export type TelegramUpdate = { update_id: number; message?: TelegramMessage };

@Injectable()
export class SupportBotService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  verifySecret(value: string | undefined): void {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected || !value || value !== expected)
      throw new ForbiddenException('Invalid Telegram webhook secret');
  }

  async receive(update: TelegramUpdate): Promise<{ ok: true }> {
    const message = update.message;
    if (!message?.from) return { ok: true };
    const operatorChatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;
    if (!operatorChatId || !process.env.TELEGRAM_BOT_TOKEN)
      throw new ServiceUnavailableException('Telegram support is not configured');
    if (String(message.chat.id) === operatorChatId)
      await this.operatorReply(message);
    else if (message.chat.type === 'private') await this.customerMessage(message);
    return { ok: true };
  }

  private async customerMessage(message: TelegramMessage): Promise<void> {
    const telegramChatId = String(message.chat.id);
    const recent = await this.prisma.supportMessage.count({
      where: {
        ticket: { telegramChatId },
        direction: 'CUSTOMER',
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent >= 10) {
      await this.sendMessage(telegramChatId, 'Juda ko‘p xabar yuborildi. Bir daqiqadan keyin qayta urinib ko‘ring.');
      // Telegram retries non-2xx webhooks. A successful acknowledgement avoids
      // turning one rate-limited update into a retry loop.
      return;
    }
    const displayName = [message.from?.first_name, message.from?.last_name]
      .filter(Boolean)
      .join(' ') || 'Telegram foydalanuvchisi';
    const ticket = await this.prisma.supportTicket.upsert({
      where: { telegramChatId },
      create: {
        telegramChatId,
        username: message.from?.username ?? null,
        displayName,
      },
      update: {
        username: message.from?.username ?? null,
        displayName,
        status: 'OPEN',
        lastMessageAt: new Date(),
      },
    });
    const body = (message.text ?? message.caption ?? '[Fayl yoki media]').slice(0, 4000);
    const saved = await this.prisma.supportMessage.upsert({
      where: {
        ticketId_telegramMessageId: {
          ticketId: ticket.id,
          telegramMessageId: String(message.message_id),
        },
      },
      create: {
        ticketId: ticket.id,
        direction: 'CUSTOMER',
        telegramMessageId: String(message.message_id),
        body,
        metadata: { updateSource: 'telegram' },
      },
      update: {},
    });
    if (saved.operatorTelegramMessageId) return;

    const username = message.from?.username ? `@${message.from.username}` : 'username yo‘q';
    const header = `🎫 ${ticket.publicId}\n👤 ${displayName} · ${username}\n🆔 ${telegramChatId}`;
    let operatorMessageId: number;
    if (message.text) {
      operatorMessageId = await this.sendMessage(
        process.env.TELEGRAM_SUPPORT_CHAT_ID!,
        `${header}\n\n${body}\n\nJavob berish uchun shu xabarga Reply qiling.`,
      );
    } else {
      await this.sendMessage(process.env.TELEGRAM_SUPPORT_CHAT_ID!, header);
      operatorMessageId = await this.copyMessage(
        process.env.TELEGRAM_SUPPORT_CHAT_ID!,
        telegramChatId,
        message.message_id,
      );
    }
    await this.prisma.supportMessage.update({
      where: { id: saved.id },
      data: { operatorTelegramMessageId: String(operatorMessageId) },
    });
    if (ticket.createdAt.getTime() === ticket.updatedAt.getTime())
      await this.sendMessage(
        telegramChatId,
        `Murojaatingiz qabul qilindi. Ticket: ${ticket.publicId}. Support shu chatda javob beradi.`,
      );
  }

  private async operatorReply(message: TelegramMessage): Promise<void> {
    const replyId = message.reply_to_message?.message_id;
    if (!replyId) return;
    const source = await this.prisma.supportMessage.findUnique({
      where: { operatorTelegramMessageId: String(replyId) },
      include: { ticket: true },
    });
    if (!source) return;
    const command = message.text?.trim().toLowerCase();
    if (command === '/close') {
      await this.prisma.supportTicket.update({
        where: { id: source.ticketId },
        data: { status: 'CLOSED', lastMessageAt: new Date() },
      });
      await this.sendMessage(source.ticket.telegramChatId, `Ticket ${source.ticket.publicId} yopildi. Yangi savol yozsangiz qayta ochiladi.`);
      await this.sendMessage(String(message.chat.id), `✅ ${source.ticket.publicId} yopildi.`);
      return;
    }
    const operatorName = process.env.TELEGRAM_SUPPORT_OPERATOR_NAME ?? 'Resaller Support';
    const body = (message.text ?? message.caption ?? '[Fayl yoki media]').slice(0, 4000);
    if (message.text)
      await this.sendMessage(source.ticket.telegramChatId, `${operatorName}:\n${body}`);
    else
      await this.copyMessage(source.ticket.telegramChatId, String(message.chat.id), message.message_id);
    await this.prisma.supportMessage.create({
      data: {
        ticketId: source.ticketId,
        direction: 'OPERATOR',
        telegramMessageId: String(message.message_id),
        body,
        metadata: { operatorName },
      },
    });
    await this.prisma.supportTicket.update({
      where: { id: source.ticketId },
      data: { status: 'OPEN', lastMessageAt: new Date() },
    });
  }

  private async sendMessage(chatId: string, text: string): Promise<number> {
    const result = await this.telegram('sendMessage', { chat_id: chatId, text });
    return Number((result as { message_id: number }).message_id);
  }

  private async copyMessage(chatId: string, fromChatId: string, messageId: number): Promise<number> {
    const result = await this.telegram('copyMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
    return Number((result as { message_id: number }).message_id);
  }

  private async telegram(method: string, body: object): Promise<unknown> {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result?: unknown;
    } | null;
    if (!response.ok || !payload?.ok)
      throw new ServiceUnavailableException('Telegram delivery failed');
    return payload.result;
  }
}
