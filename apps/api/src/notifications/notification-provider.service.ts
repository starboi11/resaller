import { Injectable } from '@nestjs/common';

type Channel = 'EMAIL' | 'TELEGRAM' | 'PUSH';
type NotificationMessage = { id: string; type: string; severity: string; payload: unknown };

@Injectable()
export class NotificationProviderService {
  enabled(channel: Channel): boolean {
    if (channel === 'TELEGRAM') return Boolean(process.env.TELEGRAM_BOT_TOKEN);
    return Boolean(process.env[channel === 'EMAIL' ? 'EMAIL_WEBHOOK_URL' : 'PUSH_WEBHOOK_URL']);
  }

  async send(channel: Channel, target: string, notification: NotificationMessage): Promise<void> {
    if (!this.enabled(channel)) throw new Error(`${channel} provider is not configured`);
    if (channel === 'TELEGRAM') {
      const token = process.env.TELEGRAM_BOT_TOKEN!;
      await this.post(`https://api.telegram.org/bot${token}/sendMessage`, undefined, {
        chat_id: target,
        text: this.message(notification),
      }, notification.id);
      return;
    }
    const prefix = channel === 'EMAIL' ? 'EMAIL' : 'PUSH';
    await this.post(process.env[`${prefix}_WEBHOOK_URL`]!, process.env[`${prefix}_WEBHOOK_TOKEN`], {
      deliveryKey: notification.id,
      channel,
      target,
      notification,
    }, notification.id);
  }

  private message(notification: NotificationMessage): string {
    const payload = notification.payload && typeof notification.payload === 'object' ? JSON.stringify(notification.payload) : String(notification.payload ?? '');
    return `[Resaller] ${notification.type}\n${payload}`.slice(0, 4000);
  }

  private async post(url: string, token: string | undefined, body: unknown, idempotencyKey: string): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  }
}
