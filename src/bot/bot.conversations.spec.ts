import type { Context } from 'grammy';
import {
  cheeseConversation,
  milkConversation,
  type BotConversation,
} from './bot.conversations';
import { CHEESE_OPTIONS, cheeseKeyboard, startKeyboard } from './bot.keyboards';

describe('bot conversations', () => {
  it('offers cheese buttons and returns to the start keyboard', async () => {
    const replyToAnswer = jest.fn().mockResolvedValue(undefined);
    const answerContext = {
      message: { text: 'Mozzarella' },
      reply: replyToAnswer,
    } as unknown as Context;
    const andFrom = jest.fn().mockResolvedValue(answerContext);
    const waitForHears = jest.fn().mockReturnValue({ andFrom });
    const conversation = { waitForHears } as unknown as BotConversation;
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      from: { id: 42 },
      reply,
    } as unknown as Context;

    await cheeseConversation(conversation, context);

    expect(reply).toHaveBeenCalledWith('What is your favorite cheese?', {
      reply_markup: cheeseKeyboard,
    });
    expect(waitForHears).toHaveBeenCalledWith(CHEESE_OPTIONS);
    expect(andFrom).toHaveBeenCalledWith(42);
    expect(replyToAnswer).toHaveBeenCalledWith(
      'Nice choice! You picked Mozzarella. Choose another flow:',
      { reply_markup: startKeyboard },
    );
  });

  it('waits for the same user in the milk flow', async () => {
    const replyToAnswer = jest.fn().mockResolvedValue(undefined);
    const answerContext = {
      message: { text: 'Oat' },
      reply: replyToAnswer,
    } as unknown as Context;
    const andFrom = jest.fn().mockResolvedValue(answerContext);
    const waitFor = jest.fn().mockReturnValue({ andFrom });
    const conversation = { waitFor } as unknown as BotConversation;
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      from: { id: 42 },
      reply,
    } as unknown as Context;

    await milkConversation(conversation, context);

    expect(reply).toHaveBeenCalledTimes(1);
    expect(waitFor).toHaveBeenCalledWith('message:text');
    expect(andFrom).toHaveBeenCalledWith(42);
    expect(replyToAnswer).toHaveBeenCalledWith('Got it! You picked Oat.');
  });
});
