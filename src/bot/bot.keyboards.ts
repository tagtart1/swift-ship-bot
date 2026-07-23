import { Keyboard } from 'grammy';

export const CHEESE_BUTTON = '🧀 Cheese';
export const MILK_BUTTON = '🥛 Milk';

export const CHEESE_OPTIONS = [
  'Blue cheese',
  'Colby Jack',
  'Mozzarella',
  'Parmesan',
];

export const startKeyboard = new Keyboard()
  .text(CHEESE_BUTTON)
  .text(MILK_BUTTON)
  .resized()
  .persistent()
  .placeholder('Choose cheese or milk');

export const cheeseKeyboard = new Keyboard()
  .text(CHEESE_OPTIONS[0])
  .text(CHEESE_OPTIONS[1])
  .row()
  .text(CHEESE_OPTIONS[2])
  .text(CHEESE_OPTIONS[3])
  .resized()
  .oneTime()
  .placeholder('Choose a cheese');
