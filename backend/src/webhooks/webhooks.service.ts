import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly configService: ConfigService) {}

  async handleGitHubWebhook(
    event: string,
    payload: any,
    signature: string,
  ): Promise<void> {
    // Verify signature
    const secret = this.configService.get('GITHUB_WEBHOOK_SECRET');
    if (secret && !this.verifyGitHubSignature(payload, signature, secret)) {
      throw new Error('Invalid signature');
    }

    this.logger.log(`Received GitHub event: ${event}`);

    // TODO: Process different event types
    switch (event) {
      case 'pull_request':
        await this.handlePullRequest(payload);
        break;
      case 'issues':
        await this.handleIssue(payload);
        break;
      case 'push':
        await this.handlePush(payload);
        break;
      default:
        this.logger.debug(`Unhandled event: ${event}`);
    }
  }

  async handleSlackEvent(payload: any): Promise<any> {
    // Handle Slack URL verification challenge
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    this.logger.log(`Received Slack event: ${payload.event?.type}`);

    // TODO: Process different event types
    if (payload.event?.type === 'message') {
      await this.handleSlackMessage(payload.event);
    }

    return { ok: true };
  }

  async handleSlackCommand(payload: any): Promise<any> {
    const { command, text, user_id, channel_id, team_id } = payload;

    this.logger.log(`Received Slack command: ${command} from ${user_id}`);

    if (command === '/defrag') {
      // TODO: Process the query and return response
      return {
        response_type: 'ephemeral',
        text: `Searching for: "${text}"...\n\n_This feature is coming soon!_`,
      };
    }

    return {
      response_type: 'ephemeral',
      text: 'Unknown command',
    };
  }

  private verifyGitHubSignature(
    payload: any,
    signature: string,
    secret: string,
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  private async handlePullRequest(payload: any): Promise<void> {
    // TODO: Create/update context item for PR
    this.logger.debug(`PR ${payload.action}: ${payload.pull_request?.title}`);
  }

  private async handleIssue(payload: any): Promise<void> {
    // TODO: Create/update context item for issue
    this.logger.debug(`Issue ${payload.action}: ${payload.issue?.title}`);
  }

  private async handlePush(payload: any): Promise<void> {
    // TODO: Process commits
    this.logger.debug(`Push to ${payload.ref}: ${payload.commits?.length} commits`);
  }

  private async handleSlackMessage(event: any): Promise<void> {
    // TODO: Create context item for message
    this.logger.debug(`Slack message in ${event.channel}`);
  }
}
