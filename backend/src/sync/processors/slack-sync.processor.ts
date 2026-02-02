import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlackOAuthService, SlackChannel } from '../../oauth/providers/slack.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ContextItem, SourceType } from '../../database/entities/context-item.entity';
import { Provider } from '../../database/entities/user-connection.entity';
import { SlackTransformer } from '../transformers/slack.transformer';

export interface SlackSyncJobData {
  workspaceId: string;
  userId: string;
  syncType: 'full' | 'incremental';
  oldest?: string;
  channelIds?: string[];
}

export interface SlackSyncResult {
  itemsSynced: number;
  errors: string[];
}

@Processor('slack-sync')
export class SlackSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackSyncProcessor.name);
  private readonly RATE_LIMIT_DELAY = 350; // Slack Tier 2 rate limit

  constructor(
    private readonly slackService: SlackOAuthService,
    private readonly integrationsService: IntegrationsService,
    @InjectRepository(ContextItem)
    private readonly itemsRepository: Repository<ContextItem>,
  ) {
    super();
  }

  async process(job: Job<SlackSyncJobData>): Promise<SlackSyncResult> {
    const { workspaceId, syncType, oldest, channelIds } = job.data;
    this.logger.log(`Starting Slack sync for workspace ${workspaceId} (${syncType})`);

    const result: SlackSyncResult = { itemsSynced: 0, errors: [] };

    try {
      const accessToken = await this.integrationsService.getDecryptedAccessToken(
        workspaceId,
        Provider.SLACK,
      );

      if (!accessToken) {
        result.errors.push('Slack integration not found or token invalid');
        return result;
      }

      // Get team domain from config for building URLs
      const teamDomain = await this.getTeamDomain(workspaceId);

      // Get channels to sync
      let channels: SlackChannel[];
      if (channelIds && channelIds.length > 0) {
        const allChannels = await this.slackService.getChannels(accessToken);
        channels = allChannels.filter((c) => channelIds.includes(c.id));
      } else {
        channels = await this.slackService.getChannels(accessToken);
        // Filter to only channels the bot/user is a member of
        channels = channels.filter((c) => c.is_member);
      }

      await job.updateProgress({ phase: 'fetched_channels', count: channels.length });

      // Sync each channel
      for (const channel of channels) {
        try {
          await this.syncChannel(accessToken, channel, workspaceId, oldest, teamDomain, job);
          await this.delay(this.RATE_LIMIT_DELAY);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Error syncing channel ${channel.name}: ${errorMsg}`);
          result.errors.push(`#${channel.name}: ${errorMsg}`);
        }
      }

      result.itemsSynced = await this.countSyncedItems(workspaceId);
      this.logger.log(`Slack sync completed: ${result.itemsSynced} items`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Slack sync failed: ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  private async syncChannel(
    accessToken: string,
    channel: SlackChannel,
    workspaceId: string,
    oldest?: string,
    teamDomain?: string,
    job?: Job,
  ): Promise<void> {
    let cursor: string | undefined;
    let messagesProcessed = 0;

    while (true) {
      const { messages, hasMore, nextCursor, retryAfter } =
        await this.slackService.getChannelHistory(accessToken, channel.id, {
          oldest,
          cursor,
          limit: 100,
        });

      // Handle rate limiting
      if (retryAfter) {
        this.logger.warn(`Slack rate limited, waiting ${retryAfter}s`);
        await this.delay(retryAfter * 1000);
        continue;
      }

      // Process messages
      for (const message of messages) {
        // Skip messages without text
        if (!message.text || message.type !== 'message') continue;

        // If message is a thread parent, sync the entire thread
        if (message.thread_ts === message.ts && message.reply_count && message.reply_count > 0) {
          await this.syncThread(accessToken, channel, message.ts, workspaceId, teamDomain);
        } else if (!message.thread_ts) {
          // Regular message (not a thread reply)
          const transformed = SlackTransformer.transformMessage(message, channel, teamDomain);
          await this.upsertItem(workspaceId, transformed);
        }
        // Thread replies are handled by syncThread

        messagesProcessed++;
      }

      if (job) {
        await job.updateProgress({
          phase: 'syncing_channel',
          channel: channel.name,
          messagesProcessed,
        });
      }

      if (!hasMore || !nextCursor) break;
      cursor = nextCursor;
      await this.delay(this.RATE_LIMIT_DELAY);
    }
  }

  private async syncThread(
    accessToken: string,
    channel: SlackChannel,
    threadTs: string,
    workspaceId: string,
    teamDomain?: string,
  ): Promise<void> {
    const allReplies: any[] = [];
    let cursor: string | undefined;

    while (true) {
      const { messages, hasMore, nextCursor } = await this.slackService.getThreadReplies(
        accessToken,
        channel.id,
        threadTs,
        { cursor },
      );

      allReplies.push(...messages);

      if (!hasMore || !nextCursor) break;
      cursor = nextCursor;
      await this.delay(this.RATE_LIMIT_DELAY);
    }

    if (allReplies.length > 0) {
      const parentMessage = allReplies.find((m) => m.ts === threadTs) || allReplies[0];
      const transformed = SlackTransformer.transformThread(
        parentMessage,
        allReplies,
        channel,
        teamDomain,
      );
      await this.upsertItem(workspaceId, transformed);
    }
  }

  private async getTeamDomain(workspaceId: string): Promise<string | undefined> {
    // This would typically come from the integration config
    // For now, return undefined and the transformer will skip URL generation
    return undefined;
  }

  private async upsertItem(
    workspaceId: string,
    item: {
      externalId: string;
      sourceType: SourceType;
      title: string;
      content: string;
      sourceUrl: string | null;
      metadata: Record<string, any>;
      importanceScore: number;
    },
  ): Promise<void> {
    const existing = await this.itemsRepository.findOne({
      where: {
        workspaceId,
        sourceType: item.sourceType,
        externalId: item.externalId,
      },
    });

    if (existing) {
      await this.itemsRepository.update(existing.id, {
        title: item.title,
        content: item.content,
        sourceUrl: item.sourceUrl,
        metadata: item.metadata,
        importanceScore: item.importanceScore,
      });
    } else {
      await this.itemsRepository.save(
        this.itemsRepository.create({
          workspaceId,
          ...item,
        }),
      );
    }
  }

  private async countSyncedItems(workspaceId: string): Promise<number> {
    return this.itemsRepository.count({
      where: {
        workspaceId,
        sourceType: SourceType.SLACK_MESSAGE,
      },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
