import { Bot } from "grammy";

const bot = new Bot(Deno.env.get("BOT_TOKEN")!);

// Handle the /start command.
bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
bot.command("purchase", (ctx) => ctx.reply("Purchase command"));
bot.command("matt", (ctx) => ctx.reply("JIMMY JIMMY JIMMY command"));
bot.command("jimmy", (ctx) => ctx.reply("Matt oh matt oh matt oh"));

// Handle other messages.
bot.on("message", (ctx) => ctx.reply("Got another message!"));

// Start the bot.
bot.start();
