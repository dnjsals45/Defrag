import { SourceType } from '../../database/entities/context-item.entity';
import { SlackMessage, SlackChannel } from '../../oauth/providers/slack.service';

export interface TransformedItem {
  externalId: string;
  sourceType: SourceType;
  title: string;
  content: string;
  sourceUrl: string | null;
  metadata: Record<string, any>;
  importanceScore: number;
  createdAt?: Date;
}

export class SlackTransformer {
  static transformMessage(
    message: SlackMessage,
    channel: SlackChannel,
    teamDomain?: string,
  ): TransformedItem {
    const timestamp = parseFloat(message.ts);
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Build content from message text and attachments
    const contentParts = [message.text];
    if (message.attachments) {
      message.attachments.forEach((att) => {
        if (att.text) contentParts.push(att.text);
        else if (att.fallback) contentParts.push(att.fallback);
      });
    }

    // Build source URL if team domain is available
    let sourceUrl: string | null = null;
    if (teamDomain) {
      const tsForUrl = message.ts.replace('.', '');
      sourceUrl = `https://${teamDomain}.slack.com/archives/${channel.id}/p${tsForUrl}`;
    }

    return {
      externalId: `slack:${channel.id}:${message.ts}`,
      sourceType: SourceType.SLACK_MESSAGE,
      title: `#${channel.name} - ${dateStr}`,
      content: contentParts.join('\n\n'),
      sourceUrl,
      metadata: {
        channelId: channel.id,
        channelName: channel.name,
        ts: message.ts,
        userId: message.user,
        threadTs: message.thread_ts,
        isThreadReply: !!message.thread_ts && message.thread_ts !== message.ts,
        replyCount: message.reply_count || 0,
        reactions: message.reactions?.map((r) => ({ name: r.name, count: r.count })) || [],
        hasFiles: (message.files?.length || 0) > 0,
        date: date.toISOString(),
      },
      importanceScore: SlackTransformer.calculateImportance(message),
      createdAt: date,
    };
  }

  static transformThread(
    parentMessage: SlackMessage,
    replies: SlackMessage[],
    channel: SlackChannel,
    teamDomain?: string,
  ): TransformedItem {
    const timestamp = parseFloat(parentMessage.ts);
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Build content from parent and all replies
    const contentParts = [
      `[Thread Start] ${parentMessage.text}`,
      ...replies
        .filter((r) => r.ts !== parentMessage.ts)
        .map((r) => `[Reply] ${r.text}`),
    ];

    let sourceUrl: string | null = null;
    if (teamDomain) {
      const tsForUrl = parentMessage.ts.replace('.', '');
      sourceUrl = `https://${teamDomain}.slack.com/archives/${channel.id}/p${tsForUrl}`;
    }

    return {
      externalId: `slack:thread:${channel.id}:${parentMessage.ts}`,
      sourceType: SourceType.SLACK_MESSAGE,
      title: `#${channel.name} Thread - ${dateStr}`,
      content: contentParts.join('\n\n'),
      sourceUrl,
      metadata: {
        channelId: channel.id,
        channelName: channel.name,
        threadTs: parentMessage.ts,
        userId: parentMessage.user,
        replyCount: replies.length - 1,
        participants: [...new Set(replies.map((r) => r.user).filter(Boolean))],
        date: date.toISOString(),
        isThread: true,
      },
      importanceScore: SlackTransformer.calculateThreadImportance(parentMessage, replies),
      createdAt: date,
    };
  }

  private static calculateImportance(message: SlackMessage): number {
    let score = 0.3;

    // Reactions indicate importance
    const totalReactions = message.reactions?.reduce((sum, r) => sum + r.count, 0) || 0;
    if (totalReactions > 10) score += 0.3;
    else if (totalReactions > 5) score += 0.2;
    else if (totalReactions > 0) score += 0.1;

    // Thread starter with many replies
    if (message.reply_count) {
      if (message.reply_count > 10) score += 0.25;
      else if (message.reply_count > 5) score += 0.15;
      else if (message.reply_count > 0) score += 0.1;
    }

    // Messages with files might be important
    if (message.files && message.files.length > 0) score += 0.1;

    // Longer messages might have more context
    if (message.text.length > 500) score += 0.1;

    return Math.min(score, 1.0);
  }

  private static calculateThreadImportance(
    parentMessage: SlackMessage,
    replies: SlackMessage[],
  ): number {
    let score = 0.5;

    // More replies = more important discussion
    if (replies.length > 20) score += 0.3;
    else if (replies.length > 10) score += 0.2;
    else if (replies.length > 5) score += 0.1;

    // Multiple participants = broader discussion
    const participants = new Set(replies.map((r) => r.user).filter(Boolean));
    if (participants.size > 5) score += 0.15;
    else if (participants.size > 3) score += 0.1;

    // Combine with parent message importance
    score += SlackTransformer.calculateImportance(parentMessage) * 0.2;

    return Math.min(score, 1.0);
  }
}
