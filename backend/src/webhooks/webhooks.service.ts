import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as crypto from "crypto";
import {
  ContextItem,
  SourceType,
} from "../database/entities/context-item.entity";
import { GitHubTransformer } from "../sync/transformers/github.transformer";
import { SlackTransformer } from "../sync/transformers/slack.transformer";
import { NotionTransformer } from "../sync/transformers/notion.transformer";
import { WebhookWorkspaceService } from "./webhook-workspace.service";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ContextItem)
    private readonly contextItemRepository: Repository<ContextItem>,
    @InjectQueue("embedding")
    private readonly embeddingQueue: Queue,
    private readonly webhookWorkspaceService: WebhookWorkspaceService,
  ) {}

  async handleGitHubWebhook(
    event: string,
    payload: any,
    signature: string,
  ): Promise<void> {
    // Verify signature
    const secret = this.configService.get("GITHUB_WEBHOOK_SECRET");
    if (secret && !this.verifyGitHubSignature(payload, signature, secret)) {
      throw new Error("Invalid signature");
    }

    this.logger.log(`Received GitHub event: ${event}`);

    // Process different event types
    switch (event) {
      case "pull_request":
        await this.handlePullRequest(payload);
        break;
      case "issues":
        await this.handleIssue(payload);
        break;
      case "push":
        await this.handlePush(payload);
        break;
      default:
        this.logger.debug(`Unhandled event: ${event}`);
    }
  }

  async handleSlackEvent(payload: any): Promise<any> {
    // Handle Slack URL verification challenge
    if (payload.type === "url_verification") {
      return { challenge: payload.challenge };
    }

    this.logger.log(`Received Slack event: ${payload.event?.type}`);

    // Process different event types
    if (payload.event?.type === "message") {
      await this.handleSlackMessage(payload.event, payload.team_id);
    }

    return { ok: true };
  }

  async handleSlackCommand(payload: any): Promise<any> {
    const { command, text, user_id, channel_id, team_id } = payload;

    this.logger.log(`Received Slack command: ${command} from ${user_id}`);

    if (command === "/defrag") {
      // TODO: Process the query and return response
      return {
        response_type: "ephemeral",
        text: `Searching for: "${text}"...\n\n_This feature is coming soon!_`,
      };
    }

    return {
      response_type: "ephemeral",
      text: "Unknown command",
    };
  }

  async handleNotionWebhook(payload: any): Promise<void> {
    this.logger.log(`Received Notion webhook: ${payload.type}`);

    // Process page.updated events
    if (payload.type === "page.updated") {
      const pageId = payload.data?.id;
      if (!pageId) {
        this.logger.warn("No page ID in Notion webhook payload");
        return;
      }

      // Extract workspace ID from payload
      const notionWorkspaceId = payload.workspace_id;
      if (!notionWorkspaceId) {
        this.logger.warn("No workspace ID in Notion webhook payload");
        return;
      }

      // Find workspace by Notion workspace ID
      const workspaceId =
        await this.webhookWorkspaceService.findWorkspaceByNotionWorkspace(
          notionWorkspaceId,
        );

      if (!workspaceId) {
        this.logger.debug(
          `No workspace found for Notion workspace: ${notionWorkspaceId}`,
        );
        return;
      }

      // Transform minimal page data (webhook doesn't include full content)
      const title =
        payload.data?.properties?.title?.title?.[0]?.plain_text || "Untitled";
      const url =
        payload.data?.url || `https://notion.so/${pageId.replace(/-/g, "")}`;

      const transformed = {
        externalId: `notion:page:${pageId}`,
        sourceType: SourceType.NOTION_PAGE,
        title,
        content: title, // Webhook only has title, full sync will get blocks
        sourceUrl: url,
        metadata: {
          pageId,
          lastEditedTime: payload.data?.last_edited_time,
          webhookUpdate: true,
        },
        importanceScore: 0.5,
      };

      // Upsert context item
      const item = await this.upsertContextItem(workspaceId, transformed);

      // Queue embedding generation
      await this.embeddingQueue.add("generate", {
        itemIds: [item.id],
        workspaceId,
      });

      this.logger.log(`Processed Notion page update: ${pageId}`);
    }
  }

  private verifyGitHubSignature(
    payload: any,
    signature: string,
    secret: string,
  ): boolean {
    const hmac = crypto.createHmac("sha256", secret);
    const digest =
      "sha256=" + hmac.update(JSON.stringify(payload)).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  private async handlePullRequest(payload: any): Promise<void> {
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      this.logger.warn("No repository full name in PR payload");
      return;
    }

    // Find workspace by repository
    const workspaceId =
      await this.webhookWorkspaceService.findWorkspaceByGitHubRepo(
        repoFullName,
      );

    if (!workspaceId) {
      this.logger.debug(`No workspace found for GitHub repo: ${repoFullName}`);
      return;
    }

    // Transform PR using GitHubTransformer
    const transformed = GitHubTransformer.transformPullRequest(
      payload.pull_request,
      repoFullName,
    );

    // Upsert context item
    const item = await this.upsertContextItem(workspaceId, transformed);

    // Queue embedding generation
    await this.embeddingQueue.add("generate", {
      itemIds: [item.id],
      workspaceId,
    });

    this.logger.log(
      `Processed PR ${payload.action}: ${payload.pull_request?.title}`,
    );
  }

  private async handleIssue(payload: any): Promise<void> {
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      this.logger.warn("No repository full name in issue payload");
      return;
    }

    // Find workspace by repository
    const workspaceId =
      await this.webhookWorkspaceService.findWorkspaceByGitHubRepo(
        repoFullName,
      );

    if (!workspaceId) {
      this.logger.debug(`No workspace found for GitHub repo: ${repoFullName}`);
      return;
    }

    // Transform issue using GitHubTransformer
    const transformed = GitHubTransformer.transformIssue(
      payload.issue,
      repoFullName,
    );

    // Upsert context item
    const item = await this.upsertContextItem(workspaceId, transformed);

    // Queue embedding generation
    await this.embeddingQueue.add("generate", {
      itemIds: [item.id],
      workspaceId,
    });

    this.logger.log(
      `Processed issue ${payload.action}: ${payload.issue?.title}`,
    );
  }

  private async handlePush(payload: any): Promise<void> {
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      this.logger.warn("No repository full name in push payload");
      return;
    }

    // Find workspace by repository
    const workspaceId =
      await this.webhookWorkspaceService.findWorkspaceByGitHubRepo(
        repoFullName,
      );

    if (!workspaceId) {
      this.logger.debug(`No workspace found for GitHub repo: ${repoFullName}`);
      return;
    }

    // Process each commit
    const commits = payload.commits || [];
    const itemIds: string[] = [];

    for (const commit of commits) {
      // Transform commit using GitHubTransformer
      const transformed = GitHubTransformer.transformCommit(
        commit,
        repoFullName,
      );

      // Upsert context item
      const item = await this.upsertContextItem(workspaceId, transformed);
      itemIds.push(item.id);
    }

    // Queue embedding generation for all commits
    if (itemIds.length > 0) {
      await this.embeddingQueue.add("generate", {
        itemIds,
        workspaceId,
      });
    }

    this.logger.log(
      `Processed push to ${payload.ref}: ${commits.length} commits`,
    );
  }

  private async handleSlackMessage(event: any, teamId: string): Promise<void> {
    if (!teamId) {
      this.logger.warn("No team ID in Slack message event");
      return;
    }

    // Find workspace by team ID
    const workspaceId =
      await this.webhookWorkspaceService.findWorkspaceBySlackTeam(teamId);

    if (!workspaceId) {
      this.logger.debug(`No workspace found for Slack team: ${teamId}`);
      return;
    }

    // Build minimal SlackChannel object from event data
    const channel = {
      id: event.channel,
      name: event.channel, // Webhook doesn't include channel name
      is_member: true,
      is_private: false,
    };

    // Transform message using SlackTransformer
    const transformed = SlackTransformer.transformMessage(event, channel);

    // Upsert context item
    const item = await this.upsertContextItem(workspaceId, transformed);

    // Queue embedding generation
    await this.embeddingQueue.add("generate", {
      itemIds: [item.id],
      workspaceId,
    });

    this.logger.log(`Processed Slack message in ${event.channel}`);
  }

  /**
   * Upsert context item - find existing by (workspaceId, sourceType, externalId), update or create
   */
  private async upsertContextItem(
    workspaceId: string,
    transformed: {
      externalId: string;
      sourceType: SourceType;
      title: string;
      content: string;
      sourceUrl: string | null;
      metadata: Record<string, any>;
      importanceScore: number;
    },
  ): Promise<ContextItem> {
    // Find existing item
    const existing = await this.contextItemRepository.findOne({
      where: {
        workspaceId,
        sourceType: transformed.sourceType,
        externalId: transformed.externalId,
      },
    });

    if (existing) {
      // Update existing item
      existing.title = transformed.title;
      existing.content = transformed.content;
      existing.sourceUrl = transformed.sourceUrl;
      existing.metadata = transformed.metadata;
      existing.importanceScore = transformed.importanceScore;

      return await this.contextItemRepository.save(existing);
    } else {
      // Create new item
      const newItem = this.contextItemRepository.create({
        workspaceId,
        sourceType: transformed.sourceType,
        externalId: transformed.externalId,
        title: transformed.title,
        content: transformed.content,
        sourceUrl: transformed.sourceUrl,
        metadata: transformed.metadata,
        importanceScore: transformed.importanceScore,
      });

      return await this.contextItemRepository.save(newItem);
    }
  }
}
