import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { conversations, createConversation } from '@grammyjs/conversations';
import type { Request, Response } from 'express';
import { Bot, MemorySessionStorage, webhookCallback } from 'grammy';
import { cheeseConversation, milkConversation } from './bot.conversations';
import type { BotContext } from './bot.types';

@Injectable()
export class BotService {
  private readonly handleUpdate: (
    request: Request,
    response: Response,
  ) => Promise<void>;

  constructor(configService: ConfigService) {
    const token = configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const webhookSecret = configService.getOrThrow<string>(
      'TELEGRAM_WEBHOOK_SECRET',
    );

    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
      throw new Error('TELEGRAM_WEBHOOK_SECRET is invalid');
    }

    const bot = new Bot<BotContext>(token);

    bot.use(
      conversations({
        storage: {
          type: 'key',
          adapter: new MemorySessionStorage(),
          getStorageKey: (context) => context.from?.id.toString(),
        },
      }),
    );
    bot.use(createConversation(cheeseConversation));
    bot.use(createConversation(milkConversation));

    bot.command('start', (context) =>
      context.reply(
        'Welcome! Choose a flow:\n/cheese - talk about cheese\n/milk - talk about milk',
      ),
    );
    bot.command('cheese', (context) =>
      context.conversation.enter('cheeseConversation'),
    );
    bot.command('milk', (context) =>
      context.conversation.enter('milkConversation'),
    );
    bot.on('message', (context) =>
      context.reply('Use /start to see the available flows.'),
    );

    this.handleUpdate = webhookCallback(bot, 'express', {
      secretToken: webhookSecret,
    });
  }

  handleWebhook(request: Request, response: Response): Promise<void> {
    return this.handleUpdate(request, response);
  }
}
