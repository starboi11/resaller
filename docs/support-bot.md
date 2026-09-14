# Telegram support bot

The bot turns private Telegram messages into auditable support tickets.

## Operator flow

- A customer sends text or media to the bot.
- The configured private operator group receives the ticket ID, display name,
  Telegram username (when available), numeric chat ID and message.
- An operator replies to that forwarded message. The bot routes the response to
  the correct customer and prefixes text with `TELEGRAM_SUPPORT_OPERATOR_NAME`.
- Reply with `/close` to close a ticket. A later customer message reopens it.
- Duplicate webhook deliveries are idempotent and each customer is limited to
  ten messages per minute.

Telegram bots cannot impersonate or send from an operator's personal account.
They always send as the bot; the configured operator name identifies the human
reply in the message body.

## Owner setup

1. Create the bot with Telegram `@BotFather` and keep its token private.
2. Create a private operator group, add the bot, and grant permission to post.
3. Obtain the group's numeric chat ID and set these values only in `.env` or the
   production secret manager:

```dotenv
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_WEBHOOK_SECRET=<random 32+ character secret>
TELEGRAM_SUPPORT_CHAT_ID=<private group numeric ID, usually starts with -100>
TELEGRAM_SUPPORT_OPERATOR_NAME=Ziyodxon
TELEGRAM_WEBHOOK_URL=https://api.resaller.uz/api/v1/support/telegram/webhook
```

4. After the public HTTPS API is deployed, run:

```sh
node scripts/register-telegram-webhook.mjs
```

Never paste these secrets into chat, commit them to Git, or expose the webhook
without its secret header.
