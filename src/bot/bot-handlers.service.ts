import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { Bot, InputFile } from 'grammy';
import { AccountsService } from '../accounts/accounts.service';
import { CHEESE_BUTTON, MILK_BUTTON, startKeyboard } from './bot.keyboards';
import type { BotContext } from './bot.types';

const welcomeImagePath = join(__dirname, 'assets', 'welcome-frog.jpg');

const balanceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

@Injectable()
export class BotHandlersService {
  private welcomePhotoFileId?: string;

  constructor(private readonly accountsService: AccountsService) {}

  register(bot: Bot<BotContext>): void {
    bot.command('start', (context) => this.handleStart(context));
    bot.command('cheese', (context) =>
      context.conversation.enter('cheeseConversation'),
    );
    bot.hears(CHEESE_BUTTON, (context) =>
      context.conversation.enter('cheeseConversation'),
    );
    bot.command('milk', (context) =>
      context.conversation.enter('milkConversation'),
    );
    bot.hears(MILK_BUTTON, (context) =>
      context.conversation.enter('milkConversation'),
    );
    bot.on('message', (context) =>
      context.reply('Use /start to see the available flows.'),
    );
  }

  async handleStart(context: BotContext): Promise<void> {
    const telegramUser = context.from;
    if (telegramUser === undefined) {
      await context.reply('Unable to identify your Telegram account.');
      return;
    }

    const account = await this.accountsService.ensureTelegramAccount({
      telegramUserId: String(telegramUser.id),
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? null,
    });
    const displayName = account.username
      ? `@${account.username}`
      : [account.firstName, account.lastName].filter(Boolean).join(' ');
    const balance = balanceFormatter.format(account.balanceCents / 100);

    const message = await context.replyWithPhoto(
      this.welcomePhotoFileId ??
        new InputFile(welcomeImagePath, 'welcome-frog.jpg'),
      {
        caption: `Welcome back ${displayName},\n\nBalance: ${balance}`,
        reply_markup: startKeyboard,
      },
    );

    this.welcomePhotoFileId ??= message.photo.at(-1)?.file_id;
  }
}
