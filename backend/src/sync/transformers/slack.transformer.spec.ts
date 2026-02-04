import { SlackTransformer } from "./slack.transformer";
import { SourceType } from "../../database/entities/context-item.entity";

describe("SlackTransformer", () => {
  const mockChannel = {
    id: "C12345",
    name: "general",
    is_member: true,
    is_private: false,
  };

  describe("transformMessage", () => {
    const mockMessage = {
      ts: "1704067200.000001",
      text: "Hello, this is a test message",
      user: "U12345",
      type: "message",
      reply_count: 5,
      reactions: [
        { name: "thumbsup", count: 3 },
        { name: "heart", count: 2 },
      ],
      files: [{ id: "F1", name: "test.pdf" }],
      attachments: [{ text: "Attachment content", fallback: "Fallback" }],
    };

    it("should transform message correctly", () => {
      const result = SlackTransformer.transformMessage(
        mockMessage,
        mockChannel,
      );

      expect(result.externalId).toBe("slack:C12345:1704067200.000001");
      expect(result.sourceType).toBe(SourceType.SLACK_MESSAGE);
      expect(result.title).toContain("#general");
      expect(result.content).toContain("Hello, this is a test message");
      expect(result.content).toContain("Attachment content");
    });

    it("should include message metadata", () => {
      const result = SlackTransformer.transformMessage(
        mockMessage,
        mockChannel,
      );

      expect(result.metadata.channelId).toBe("C12345");
      expect(result.metadata.channelName).toBe("general");
      expect(result.metadata.ts).toBe("1704067200.000001");
      expect(result.metadata.userId).toBe("U12345");
      expect(result.metadata.replyCount).toBe(5);
      expect(result.metadata.hasFiles).toBe(true);
    });

    it("should generate source URL when teamDomain is provided", () => {
      const result = SlackTransformer.transformMessage(
        mockMessage,
        mockChannel,
        "myteam",
      );

      expect(result.sourceUrl).toContain("myteam.slack.com");
      expect(result.sourceUrl).toContain("/archives/C12345/");
    });

    it("should return null sourceUrl when teamDomain is not provided", () => {
      const result = SlackTransformer.transformMessage(
        mockMessage,
        mockChannel,
      );
      expect(result.sourceUrl).toBeNull();
    });

    it("should calculate higher importance for messages with many reactions", () => {
      const result = SlackTransformer.transformMessage(
        mockMessage,
        mockChannel,
      );
      expect(result.importanceScore).toBeGreaterThan(0.4);
    });

    it("should handle message without reactions", () => {
      const messageWithoutReactions = {
        ...mockMessage,
        reactions: undefined,
      };
      const result = SlackTransformer.transformMessage(
        messageWithoutReactions,
        mockChannel,
      );
      expect(result.metadata.reactions).toEqual([]);
    });

    it("should handle message without attachments", () => {
      const messageWithoutAttachments = {
        ...mockMessage,
        attachments: undefined,
      };
      const result = SlackTransformer.transformMessage(
        messageWithoutAttachments,
        mockChannel,
      );
      expect(result.content).toBe("Hello, this is a test message");
    });
  });

  describe("transformThread", () => {
    const parentMessage = {
      ts: "1704067200.000001",
      text: "Thread parent message",
      user: "U12345",
      type: "message",
      reply_count: 3,
    };

    const replies = [
      {
        ts: "1704067200.000001",
        text: "Thread parent message",
        user: "U12345",
        type: "message",
      },
      {
        ts: "1704067200.000002",
        text: "First reply",
        user: "U23456",
        type: "message",
      },
      {
        ts: "1704067200.000003",
        text: "Second reply",
        user: "U34567",
        type: "message",
      },
    ];

    it("should transform thread correctly", () => {
      const result = SlackTransformer.transformThread(
        parentMessage,
        replies,
        mockChannel,
      );

      expect(result.externalId).toBe("slack:thread:C12345:1704067200.000001");
      expect(result.sourceType).toBe(SourceType.SLACK_MESSAGE);
      expect(result.title).toContain("#general Thread");
      expect(result.content).toContain("[Thread Start]");
      expect(result.content).toContain("[Reply]");
    });

    it("should include thread metadata", () => {
      const result = SlackTransformer.transformThread(
        parentMessage,
        replies,
        mockChannel,
      );

      expect(result.metadata.isThread).toBe(true);
      expect(result.metadata.threadTs).toBe("1704067200.000001");
      expect(result.metadata.replyCount).toBe(2); // Excluding parent
      expect(result.metadata.participants).toContain("U12345");
      expect(result.metadata.participants).toContain("U23456");
    });

    it("should calculate higher importance for threads with many participants", () => {
      const manyReplies = [
        parentMessage,
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            ts: `1704067200.${String(i + 2).padStart(6, "0")}`,
            text: `Reply ${i}`,
            user: `U${i}`,
            type: "message",
          })),
      ];

      const result = SlackTransformer.transformThread(
        parentMessage,
        manyReplies,
        mockChannel,
      );

      expect(result.importanceScore).toBeGreaterThan(0.6);
    });
  });
});
