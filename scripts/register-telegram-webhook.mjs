const required = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_WEBHOOK_URL',
];
try {
  process.loadEnvFile('.env');
} catch {
  // Production can inject the same variables from its secret manager.
}
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
if (process.env.TELEGRAM_WEBHOOK_SECRET.length < 32)
  throw new Error('TELEGRAM_WEBHOOK_SECRET must contain at least 32 characters');

const token = process.env.TELEGRAM_BOT_TOKEN;
const call = async (method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(`Telegram ${method} failed: ${result.description ?? response.status}`);
  return result.result;
};

const bot = await call('getMe', {});
await call('setWebhook', {
  url: process.env.TELEGRAM_WEBHOOK_URL,
  secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
  allowed_updates: ['message'],
  drop_pending_updates: false,
});
console.log(`Webhook registered for @${bot.username}.`);
