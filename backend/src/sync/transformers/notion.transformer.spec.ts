import { NotionTransformer } from "./notion.transformer";
import { SourceType } from "../../database/entities/context-item.entity";
import { NotionPage, NotionBlock } from "../../oauth/providers/notion.service";

describe("NotionTransformer", () => {
  // Helper to create mock block with required properties
  const createMockBlock = (
    id: string,
    type: string,
    content: Record<string, any>,
  ): NotionBlock => ({
    id,
    object: "block",
    type,
    created_time: "2024-01-01T00:00:00Z",
    last_edited_time: "2024-01-01T00:00:00Z",
    has_children: false,
    ...content,
  });

  // Helper to create mock page
  const createMockPage = (overrides: Partial<NotionPage> = {}): NotionPage => ({
    id: "page-123",
    object: "page",
    url: "https://notion.so/page-123",
    parent: {
      type: "database_id",
      database_id: "db-456",
    },
    properties: {
      title: {
        id: "title",
        type: "title",
        title: [{ plain_text: "Test Page Title" }],
      },
    },
    created_time: "2024-01-01T00:00:00Z",
    last_edited_time: "2024-01-15T00:00:00Z",
    ...overrides,
  });

  describe("transformPage", () => {
    const mockPage = createMockPage({
      icon: { type: "emoji", emoji: "📝" },
      properties: {
        title: {
          id: "title",
          type: "title",
          title: [{ plain_text: "Test Page Title" }],
        },
        Status: {
          id: "status",
          type: "select",
          select: { name: "In Progress" },
        },
      },
    });

    const mockBlocks: NotionBlock[] = [
      createMockBlock("block-1", "heading_1", {
        heading_1: { rich_text: [{ plain_text: "Main Heading" }] },
      }),
      createMockBlock("block-2", "paragraph", {
        paragraph: { rich_text: [{ plain_text: "This is a paragraph." }] },
      }),
      createMockBlock("block-3", "bulleted_list_item", {
        bulleted_list_item: { rich_text: [{ plain_text: "List item 1" }] },
      }),
    ];

    it("should transform page correctly", () => {
      const result = NotionTransformer.transformPage(mockPage, mockBlocks);

      expect(result.externalId).toBe("notion:page:page-123");
      expect(result.sourceType).toBe(SourceType.NOTION_PAGE);
      expect(result.title).toBe("Test Page Title");
      expect(result.sourceUrl).toBe("https://notion.so/page-123");
    });

    it("should convert blocks to text content", () => {
      const result = NotionTransformer.transformPage(mockPage, mockBlocks);

      expect(result.content).toContain("# Main Heading");
      expect(result.content).toContain("This is a paragraph.");
      expect(result.content).toContain("• List item 1");
    });

    it("should include page metadata", () => {
      const result = NotionTransformer.transformPage(mockPage, mockBlocks);

      expect(result.metadata.pageId).toBe("page-123");
      expect(result.metadata.parentType).toBe("database_id");
      expect(result.metadata.icon).toBe("📝");
      expect(result.metadata.blockCount).toBe(3);
      expect(result.metadata.properties.Status).toBe("In Progress");
    });

    it("should calculate higher importance for pages with more content", () => {
      const manyBlocks: NotionBlock[] = Array(30)
        .fill(null)
        .map((_, i) =>
          createMockBlock(`block-${i}`, "paragraph", {
            paragraph: { rich_text: [{ plain_text: `Paragraph ${i}` }] },
          }),
        );

      const result = NotionTransformer.transformPage(mockPage, manyBlocks);
      expect(result.importanceScore).toBeGreaterThan(0.6);
    });

    it("should handle page without title", () => {
      const pageWithoutTitle = createMockPage({ properties: {} });
      const result = NotionTransformer.transformPage(
        pageWithoutTitle,
        mockBlocks,
      );
      expect(result.title).toBe("Untitled");
    });
  });

  describe("extractPageTitle", () => {
    it("should extract title from properties", () => {
      const page = createMockPage({
        properties: {
          Name: {
            id: "name",
            type: "title",
            title: [{ plain_text: "Page Name" }],
          },
        },
      });

      const title = NotionTransformer.extractPageTitle(page);
      expect(title).toBe("Page Name");
    });

    it("should return Untitled for empty title", () => {
      const page = createMockPage({
        properties: {
          Name: {
            id: "name",
            type: "title",
            title: [],
          },
        },
      });

      const title = NotionTransformer.extractPageTitle(page);
      expect(title).toBe("Untitled");
    });
  });

  describe("blocksToText", () => {
    it("should convert multiple blocks to text", () => {
      const blocks: NotionBlock[] = [
        createMockBlock("1", "heading_2", {
          heading_2: { rich_text: [{ plain_text: "Section" }] },
        }),
        createMockBlock("2", "paragraph", {
          paragraph: { rich_text: [{ plain_text: "Content" }] },
        }),
      ];

      const text = NotionTransformer.blocksToText(blocks);
      expect(text).toContain("## Section");
      expect(text).toContain("Content");
    });

    it("should handle empty blocks array", () => {
      const text = NotionTransformer.blocksToText([]);
      expect(text).toBe("");
    });
  });

  describe("blockToText", () => {
    it("should convert paragraph block", () => {
      const block = createMockBlock("1", "paragraph", {
        paragraph: { rich_text: [{ plain_text: "Test paragraph" }] },
      });
      expect(NotionTransformer.blockToText(block)).toBe("Test paragraph");
    });

    it("should convert heading blocks", () => {
      const h1 = createMockBlock("1", "heading_1", {
        heading_1: { rich_text: [{ plain_text: "H1" }] },
      });
      const h2 = createMockBlock("2", "heading_2", {
        heading_2: { rich_text: [{ plain_text: "H2" }] },
      });
      const h3 = createMockBlock("3", "heading_3", {
        heading_3: { rich_text: [{ plain_text: "H3" }] },
      });

      expect(NotionTransformer.blockToText(h1)).toBe("# H1");
      expect(NotionTransformer.blockToText(h2)).toBe("## H2");
      expect(NotionTransformer.blockToText(h3)).toBe("### H3");
    });

    it("should convert list items", () => {
      const bullet = createMockBlock("1", "bulleted_list_item", {
        bulleted_list_item: { rich_text: [{ plain_text: "Bullet" }] },
      });
      const numbered = createMockBlock("2", "numbered_list_item", {
        numbered_list_item: { rich_text: [{ plain_text: "Number" }] },
      });

      expect(NotionTransformer.blockToText(bullet)).toBe("• Bullet");
      expect(NotionTransformer.blockToText(numbered)).toBe("1. Number");
    });

    it("should convert to_do block", () => {
      const checked = createMockBlock("1", "to_do", {
        to_do: { checked: true, rich_text: [{ plain_text: "Done" }] },
      });
      const unchecked = createMockBlock("2", "to_do", {
        to_do: { checked: false, rich_text: [{ plain_text: "Todo" }] },
      });

      expect(NotionTransformer.blockToText(checked)).toBe("☑ Done");
      expect(NotionTransformer.blockToText(unchecked)).toBe("☐ Todo");
    });

    it("should convert code block", () => {
      const code = createMockBlock("1", "code", {
        code: {
          language: "typescript",
          rich_text: [{ plain_text: "const x = 1;" }],
        },
      });

      const result = NotionTransformer.blockToText(code);
      expect(result).toContain("```typescript");
      expect(result).toContain("const x = 1;");
    });

    it("should convert quote block", () => {
      const quote = createMockBlock("1", "quote", {
        quote: { rich_text: [{ plain_text: "Famous quote" }] },
      });

      expect(NotionTransformer.blockToText(quote)).toBe("> Famous quote");
    });

    it("should convert callout block", () => {
      const callout = createMockBlock("1", "callout", {
        callout: {
          icon: { emoji: "⚠️" },
          rich_text: [{ plain_text: "Warning message" }],
        },
      });

      expect(NotionTransformer.blockToText(callout)).toBe("⚠️ Warning message");
    });

    it("should return null for unknown block type", () => {
      const unknown = createMockBlock("1", "unknown_type", {});
      expect(NotionTransformer.blockToText(unknown)).toBeNull();
    });
  });

  describe("extractProperties", () => {
    it("should extract various property types", () => {
      const properties = {
        Title: {
          id: "1",
          type: "title",
          title: [{ plain_text: "Test Title" }],
        },
        Description: {
          id: "2",
          type: "rich_text",
          rich_text: [{ plain_text: "Test Description" }],
        },
        Count: {
          id: "3",
          type: "number",
          number: 42,
        },
        Status: {
          id: "4",
          type: "select",
          select: { name: "Done" },
        },
        Tags: {
          id: "5",
          type: "multi_select",
          multi_select: [{ name: "Tag1" }, { name: "Tag2" }],
        },
        Done: {
          id: "6",
          type: "checkbox",
          checkbox: true,
        },
        Website: {
          id: "7",
          type: "url",
          url: "https://example.com",
        },
      };

      const extracted = NotionTransformer.extractProperties(properties);

      expect(extracted.Title).toBe("Test Title");
      expect(extracted.Description).toBe("Test Description");
      expect(extracted.Count).toBe(42);
      expect(extracted.Status).toBe("Done");
      expect(extracted.Tags).toEqual(["Tag1", "Tag2"]);
      expect(extracted.Done).toBe(true);
      expect(extracted.Website).toBe("https://example.com");
    });
  });
});
