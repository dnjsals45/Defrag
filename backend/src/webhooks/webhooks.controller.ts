import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { WebhooksService } from "./webhooks.service";

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("github")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "GitHub 웹훅", description: "GitHub 이벤트 수신" })
  @ApiHeader({ name: "x-github-event", description: "GitHub 이벤트 타입" })
  @ApiHeader({ name: "x-hub-signature-256", description: "웹훅 서명" })
  @ApiResponse({ status: 200, description: "수신 완료" })
  async handleGitHub(
    @Body() payload: any,
    @Headers("x-github-event") event: string,
    @Headers("x-hub-signature-256") signature: string,
  ) {
    await this.webhooksService.handleGitHubWebhook(event, payload, signature);
    return { received: true };
  }

  @Post("slack/events")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Slack 이벤트", description: "Slack 이벤트 수신" })
  @ApiResponse({ status: 200, description: "수신 완료" })
  async handleSlackEvents(@Body() payload: any) {
    return this.webhooksService.handleSlackEvent(payload);
  }

  @Post("slack/commands")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Slack 커맨드", description: "Slack 슬래시 커맨드 수신" })
  @ApiResponse({ status: 200, description: "수신 완료" })
  async handleSlackCommands(@Body() payload: any) {
    return this.webhooksService.handleSlackCommand(payload);
  }

  @Post("notion")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Notion 웹훅", description: "Notion 이벤트 수신" })
  @ApiResponse({ status: 200, description: "수신 완료" })
  async handleNotion(@Body() payload: any) {
    return this.webhooksService.handleNotionWebhook(payload);
  }
}
