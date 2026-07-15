import type { Conversation } from '@grammyjs/conversations';
import type { Context } from 'grammy';
import type { BotContext } from './bot.types';

export type BotConversation = Conversation<BotContext, Context>;

export async function cheeseConversation(
  conversation: BotConversation,
  context: Context,
): Promise<void> {
  const userId = context.from?.id;
  if (userId === undefined) return;

  await context.reply('Cheese flow started. What is your favorite cheese?');

  const answer = await conversation.waitFor('message:text').andFrom(userId);

  await answer.reply(`Nice choice! You picked ${answer.message.text}.`);
}

export async function milkConversation(
  conversation: BotConversation,
  context: Context,
): Promise<void> {
  const userId = context.from?.id;
  if (userId === undefined) return;

  await context.reply('Milk flow started. What kind of milk do you prefer?');

  const answer = await conversation.waitFor('message:text').andFrom(userId);

  await answer.reply(`Got it! You picked ${answer.message.text}.`);
}
