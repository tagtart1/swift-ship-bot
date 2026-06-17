import { Bot, Keyboard } from "grammy";

const bot = new Bot(Deno.env.get("BOT_TOKEN")!);

const keyboard = new Keyboard()
  .text("Yes, they certainly are")
  .row()
  .text("I'm not quite sure")
  .row()
  .text("No.")
  .resized();

// Handle the /start command.
bot.command("start", (ctx) =>
  ctx.reply("Are Swift Ship bots awesome?", {
    reply_markup: keyboard,
  }),
);
bot.command("purchase", (ctx) => ctx.reply("Purchase command"));
bot.command("matt", (ctx) => ctx.reply("JIMMY JIMMY JIMMY command"));
bot.command("jimmy", (ctx) => ctx.reply("Matt oh matt oh matt oh"));

// Handle other messages.
bot.on("message", (ctx) => ctx.reply("Got another message!"));

// Start the bot.
bot.start();
