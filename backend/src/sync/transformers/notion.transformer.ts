import { SourceType } from "../../database/entities/context-item.entity";
import {
  NotionPage,
  NotionBlock,
  NotionProperty,
} from "../../oauth/providers/notion.service";

export interface TransformedItem {
  externalId: string;
  sourceType: SourceType;
  title: string;
  content: string;
  sourceUrl: string;
  metadata: Record<string, any>;
  importanceScore: number;
  createdAt?: Date;
}

export class NotionTransformer {
  static transformPage(
    page: NotionPage,
    blocks: NotionBlock[],
  ): TransformedItem {
    const title = NotionTransformer.extractPageTitle(page);
    const content = NotionTransformer.blocksToText(blocks);

    return {
      externalId: `notion:page:${page.id}`,
      sourceType: SourceType.NOTION_PAGE,
      title,
      content,
      sourceUrl: page.url,
      metadata: {
        pageId: page.id,
        parentType: page.parent.type,
        parentId: page.parent.database_id || page.parent.page_id || "workspace",
        icon: page.icon?.emoji || page.icon?.external?.url || null,
        properties: NotionTransformer.extractProperties(page.properties),
        createdAt: page.created_time,
        updatedAt: page.last_edited_time,
        blockCount: blocks.length,
      },
      importanceScore: NotionTransformer.calculateImportance(page, blocks),
      createdAt: new Date(page.created_time),
    };
  }

  static extractPageTitle(page: NotionPage): string {
    for (const prop of Object.values(page.properties)) {
      if (prop.type === "title" && prop.title) {
        return prop.title.map((t) => t.plain_text).join("") || "Untitled";
      }
    }
    return "Untitled";
  }

  static blocksToText(blocks: NotionBlock[]): string {
    const textParts: string[] = [];

    for (const block of blocks) {
      const text = NotionTransformer.blockToText(block);
      if (text) textParts.push(text);
    }

    return textParts.join("\n\n");
  }

  static blockToText(block: NotionBlock): string | null {
    const extractRichText = (richText?: { plain_text: string }[]): string => {
      if (!richText) return "";
      return richText.map((t) => t.plain_text).join("");
    };

    switch (block.type) {
      case "paragraph":
        return extractRichText(block.paragraph?.rich_text);

      case "heading_1":
        return `# ${extractRichText(block.heading_1?.rich_text)}`;

      case "heading_2":
        return `## ${extractRichText(block.heading_2?.rich_text)}`;

      case "heading_3":
        return `### ${extractRichText(block.heading_3?.rich_text)}`;

      case "bulleted_list_item":
        return `• ${extractRichText(block.bulleted_list_item?.rich_text)}`;

      case "numbered_list_item":
        return `1. ${extractRichText(block.numbered_list_item?.rich_text)}`;

      case "to_do": {
        const checked = block.to_do?.checked ? "☑" : "☐";
        return `${checked} ${extractRichText(block.to_do?.rich_text)}`;
      }

      case "code": {
        const code = extractRichText(block.code?.rich_text);
        const lang = block.code?.language || "";
        return `\`\`\`${lang}\n${code}\n\`\`\``;
      }

      case "quote":
        return `> ${extractRichText(block.quote?.rich_text)}`;

      case "callout": {
        const icon = block.callout?.icon?.emoji || "💡";
        return `${icon} ${extractRichText(block.callout?.rich_text)}`;
      }

      default:
        return null;
    }
  }

  static extractProperties(
    properties: Record<string, NotionProperty>,
  ): Record<string, any> {
    const extracted: Record<string, any> = {};

    for (const [key, prop] of Object.entries(properties)) {
      switch (prop.type) {
        case "title":
          extracted[key] = prop.title?.map((t) => t.plain_text).join("") || "";
          break;
        case "rich_text":
          extracted[key] =
            prop.rich_text?.map((t) => t.plain_text).join("") || "";
          break;
        case "number":
          extracted[key] = prop.number;
          break;
        case "select":
          extracted[key] = prop.select?.name || null;
          break;
        case "multi_select":
          extracted[key] = prop.multi_select?.map((s) => s.name) || [];
          break;
        case "date":
          extracted[key] = prop.date;
          break;
        case "checkbox":
          extracted[key] = prop.checkbox;
          break;
        case "url":
          extracted[key] = prop.url;
          break;
        case "email":
          extracted[key] = prop.email;
          break;
      }
    }

    return extracted;
  }

  private static calculateImportance(
    page: NotionPage,
    blocks: NotionBlock[],
  ): number {
    let score = 0.5;

    // More content = more important
    if (blocks.length > 50) score += 0.2;
    else if (blocks.length > 20) score += 0.15;
    else if (blocks.length > 10) score += 0.1;

    // Recently updated pages are more relevant
    const lastEdited = new Date(page.last_edited_time);
    const daysSinceEdit =
      (Date.now() - lastEdited.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEdit < 7) score += 0.15;
    else if (daysSinceEdit < 30) score += 0.1;
    else if (daysSinceEdit > 180) score -= 0.1;

    // Database entries might be more structured/important
    if (page.parent.type === "database_id") score += 0.1;

    // Has meaningful title
    const title = NotionTransformer.extractPageTitle(page);
    if (title !== "Untitled" && title.length > 5) score += 0.05;

    return Math.max(0.1, Math.min(score, 1.0));
  }
}
