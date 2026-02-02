import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGitHub(
    @Body() payload: any,
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    await this.webhooksService.handleGitHubWebhook(event, payload, signature);
    return { received: true };
  }

  @Post('slack/events')
  @HttpCode(HttpStatus.OK)
  async handleSlackEvents(@Body() payload: any) {
    return this.webhooksService.handleSlackEvent(payload);
  }

  @Post('slack/commands')
  @HttpCode(HttpStatus.OK)
  async handleSlackCommands(@Body() payload: any) {
    return this.webhooksService.handleSlackCommand(payload);
  }

  @Post('notion')
  @HttpCode(HttpStatus.OK)
  async handleNotion(@Body() payload: any) {
    return this.webhooksService.handleNotionWebhook(payload);
  }
}
