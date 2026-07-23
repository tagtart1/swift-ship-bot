import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { BotHandlersService } from './bot-handlers.service';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';

@Module({
  imports: [AccountsModule],
  controllers: [BotController],
  providers: [BotService, BotHandlersService],
})
export class BotModule {}
