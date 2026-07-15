'use strict';

const { Bot } = require('grammy');

function requiredEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function setWebhook() {
  const token = requiredEnvironmentVariable('TELEGRAM_BOT_TOKEN');
  const webhookUrl = requiredEnvironmentVariable('TELEGRAM_WEBHOOK_URL');
  const webhookSecret = requiredEnvironmentVariable('TELEGRAM_WEBHOOK_SECRET');
  const parsedWebhookUrl = new URL(webhookUrl);

  if (
    parsedWebhookUrl.protocol !== 'https:' ||
    parsedWebhookUrl.pathname !== '/webhooks/telegram'
  ) {
    throw new Error(
      'TELEGRAM_WEBHOOK_URL must be an HTTPS URL ending in /webhooks/telegram',
    );
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is invalid');
  }

  await new Bot(token).api.setWebhook(webhookUrl, {
    secret_token: webhookSecret,
  });

  console.log(`Telegram webhook set to ${webhookUrl}`);
}

setWebhook().catch((error) => {
  console.error(`Could not set Telegram webhook: ${error.message}`);
  process.exitCode = 1;
});
