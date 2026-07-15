import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BotService } from './bot.service';

@Controller('webhooks/telegram')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post()
  handleWebhook(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.botService.handleWebhook(request, response);
  }
}
