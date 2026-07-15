import type { Request, Response } from 'express';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';

describe('BotController', () => {
  it('passes the webhook request to the bot service', async () => {
    const request = {} as Request;
    const response = {} as Response;
    const handleWebhook = jest.fn().mockResolvedValue(undefined);
    const botService = { handleWebhook } as unknown as BotService;
    const controller = new BotController(botService);

    await controller.handleWebhook(request, response);

    expect(handleWebhook).toHaveBeenCalledWith(request, response);
  });
});
