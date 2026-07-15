import type { Context } from 'grammy';
import {
  cheeseConversation,
  milkConversation,
  type BotConversation,
} from './bot.conversations';

describe('bot conversations', () => {
  it.each([
    {
      conversation: cheeseConversation,
      answer: 'Cheddar',
      expectedReply: 'Nice choice! You picked Cheddar.',
    },
    {
      conversation: milkConversation,
      answer: 'Oat',
      expectedReply: 'Got it! You picked Oat.',
    },
  ])('waits for the same user in a flow', async (testCase) => {
    const replyToAnswer = jest.fn().mockResolvedValue(undefined);
    const answerContext = {
      message: { text: testCase.answer },
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

    await testCase.conversation(conversation, context);

    expect(reply).toHaveBeenCalledTimes(1);
    expect(waitFor).toHaveBeenCalledWith('message:text');
    expect(andFrom).toHaveBeenCalledWith(42);
    expect(replyToAnswer).toHaveBeenCalledWith(testCase.expectedReply);
  });
});
