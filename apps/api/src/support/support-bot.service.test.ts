import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../infrastructure/prisma.service.js';
import { SupportBotService } from './support-bot.service.js';

describe('SupportBotService', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-secret';
    process.env.TELEGRAM_SUPPORT_CHAT_ID = '-100123';
    process.env.TELEGRAM_SUPPORT_OPERATOR_NAME = 'Ziyodxon';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
      'TELEGRAM_SUPPORT_CHAT_ID',
      'TELEGRAM_SUPPORT_OPERATOR_NAME',
    ])
      delete process.env[key];
  });

  it('forwards a customer message with identity and ticket context', async () => {
    const now = new Date();
    const prisma = {
      supportMessage: {
        count: vi.fn().mockResolvedValue(0),
        upsert: vi.fn().mockResolvedValue({ id: 'message-1', operatorTelegramMessageId: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      supportTicket: {
        upsert: vi.fn().mockResolvedValue({
          id: 'ticket-1', publicId: 'ticket-public', telegramChatId: '77',
          createdAt: now, updatedAt: now,
        }),
      },
    } as unknown as PrismaService;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: { message_id: 101 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: { message_id: 102 } }) });
    vi.stubGlobal('fetch', fetchMock);
    const service = new SupportBotService(prisma);

    await service.receive({
      update_id: 1,
      message: {
        message_id: 9,
        text: 'Buyurtmam qayerda?',
        chat: { id: 77, type: 'private' },
        from: { id: 77, first_name: 'Ali', username: 'ali_test' },
      },
    });

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { text: string };
    expect(firstBody.text).toContain('@ali_test');
    expect(firstBody.text).toContain('ticket-public');
    expect(firstBody.text).toContain('Buyurtmam qayerda?');
  });

  it('routes an operator reply back to the correct customer', async () => {
    const prisma = {
      supportMessage: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'source-1', ticketId: 'ticket-1',
          ticket: { publicId: 'ticket-public', telegramChatId: '77' },
        }),
        create: vi.fn().mockResolvedValue({}),
      },
      supportTicket: { update: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 103 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new SupportBotService(prisma);

    await service.receive({
      update_id: 2,
      message: {
        message_id: 10,
        text: 'Buyurtma yo‘lda.',
        chat: { id: -100123, type: 'supergroup' },
        from: { id: 5, first_name: 'Operator' },
        reply_to_message: { message_id: 101 },
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      chat_id: string;
      text: string;
    };
    expect(body.chat_id).toBe('77');
    expect(body.text).toBe('Ziyodxon:\nBuyurtma yo‘lda.');
  });

  it('rejects webhook requests with the wrong secret', () => {
    const service = new SupportBotService({} as PrismaService);
    expect(() => service.verifySecret('wrong')).toThrow(
      'Invalid Telegram webhook secret',
    );
  });

  it('acknowledges a rate-limited update without persisting or forwarding it', async () => {
    const prisma = {
      supportMessage: {
        count: vi.fn().mockResolvedValue(10),
        upsert: vi.fn(),
      },
      supportTicket: { upsert: vi.fn() },
    } as unknown as PrismaService;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 104 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new SupportBotService(prisma).receive({
        update_id: 3,
        message: {
          message_id: 11,
          text: 'Takroriy xabar',
          chat: { id: 77, type: 'private' },
          from: { id: 77, first_name: 'Ali' },
        },
      }),
    ).resolves.toEqual({ ok: true });
    expect(prisma.supportTicket.upsert).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
