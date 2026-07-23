import { InputFile, type Context } from 'grammy';
import {
  AccountsService,
  type AccountSummary,
} from '../accounts/accounts.service';
import { BotHandlersService } from './bot-handlers.service';
import { startKeyboard } from './bot.keyboards';
import type { BotContext } from './bot.types';

describe('BotHandlersService', () => {
  type TelegramUser = NonNullable<Context['from']>;

  const welcomePhotoFileId = 'telegram-welcome-photo-file-id';

  const baseAccount: AccountSummary = {
    userId: '89dffb8c-95fe-4abd-8bc6-1dc824117777',
    username: 'swift_shipper',
    firstName: 'Swift',
    lastName: 'Shipper',
    balanceCents: 12300,
  };

  function createHandler(account: AccountSummary = baseAccount) {
    const ensureTelegramAccount = jest.fn().mockResolvedValue(account);
    const accountsService = {
      ensureTelegramAccount,
    } as unknown as AccountsService;

    return {
      handler: new BotHandlersService(accountsService),
      ensureTelegramAccount,
    };
  }

  function createContext(from?: Partial<TelegramUser>) {
    const reply = jest.fn().mockResolvedValue(undefined);
    const replyWithPhoto = jest.fn().mockResolvedValue({
      photo: [
        {
          file_id: 'telegram-welcome-photo-thumbnail-file-id',
          file_unique_id: 'telegram-welcome-photo-thumbnail-unique-id',
          width: 90,
          height: 58,
        },
        {
          file_id: welcomePhotoFileId,
          file_unique_id: 'telegram-welcome-photo-unique-id',
          width: 678,
          height: 438,
        },
      ],
    });
    const context = {
      from:
        from === undefined
          ? undefined
          : {
              id: 123456789,
              is_bot: false,
              first_name: 'Swift',
              ...from,
            },
      reply,
      replyWithPhoto,
    } as unknown as BotContext;

    return { context, reply, replyWithPhoto };
  }

  it('synchronizes the Telegram profile and greets by username', async () => {
    const { handler, ensureTelegramAccount } = createHandler();
    const { context, reply, replyWithPhoto } = createContext({
      username: 'swift_shipper',
      last_name: 'Shipper',
      language_code: 'en',
    });

    await handler.handleStart(context);

    expect(ensureTelegramAccount).toHaveBeenCalledWith({
      telegramUserId: '123456789',
      username: 'swift_shipper',
      firstName: 'Swift',
      lastName: 'Shipper',
      languageCode: 'en',
    });
    expect(reply).not.toHaveBeenCalled();
    expect(replyWithPhoto).toHaveBeenCalledWith(expect.any(InputFile), {
      caption: 'Welcome back @swift_shipper,\n\nBalance: $123.00',
      reply_markup: startKeyboard,
    });
  });

  it.each([
    {
      account: { ...baseAccount, username: null },
      expectedName: 'Swift Shipper',
    },
    {
      account: { ...baseAccount, username: null, lastName: null },
      expectedName: 'Swift',
    },
  ])('falls back to the Telegram name', async ({ account, expectedName }) => {
    const { handler } = createHandler(account);
    const { context, replyWithPhoto } = createContext({ first_name: 'Swift' });

    await handler.handleStart(context);

    expect(replyWithPhoto).toHaveBeenCalledWith(expect.any(InputFile), {
      caption: `Welcome back ${expectedName},\n\nBalance: $123.00`,
      reply_markup: startKeyboard,
    });
  });

  it('reuses the Telegram file ID after the first photo upload', async () => {
    const { handler } = createHandler();
    const firstUser = createContext({ id: 111 });
    const secondUser = createContext({ id: 222 });

    await handler.handleStart(firstUser.context);
    await handler.handleStart(secondUser.context);

    expect(firstUser.replyWithPhoto).toHaveBeenCalledWith(
      expect.any(InputFile),
      expect.any(Object),
    );
    expect(secondUser.replyWithPhoto).toHaveBeenCalledWith(
      welcomePhotoFileId,
      expect.any(Object),
    );
  });

  it('does not access accounts when Telegram provides no sender', async () => {
    const { handler, ensureTelegramAccount } = createHandler();
    const { context, reply, replyWithPhoto } = createContext();

    await handler.handleStart(context);

    expect(ensureTelegramAccount).not.toHaveBeenCalled();
    expect(replyWithPhoto).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      'Unable to identify your Telegram account.',
    );
  });
});
