import { Injectable, Logger } from "@nestjs/common";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import axios from "axios";

export interface ExtractedArticle {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  length: number;
  lang: string | null;
}

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  /**
   * Extract article content from a URL using Mozilla Readability
   */
  async extractFromUrl(url: string): Promise<ExtractedArticle> {
    this.logger.log(`Extracting article from: ${url}`);

    // Fetch the HTML content
    const html = await this.fetchHtml(url);

    // Parse and extract article
    return this.parseArticle(html, url);
  }

  /**
   * Fetch HTML content from a URL
   */
  private async fetchHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: 30000, // 30 seconds timeout
        maxRedirects: 5,
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch URL ${url}: ${error.message}`);
      throw new Error(`Failed to fetch article: ${error.message}`);
    }
  }

  /**
   * Parse HTML and extract article content using Readability
   */
  private parseArticle(html: string, url: string): ExtractedArticle {
    try {
      // Create a DOM from the HTML
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Use Readability to extract the article
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        throw new Error("Could not extract article content from the page");
      }

      return {
        title: article.title || "Untitled",
        content: article.content || "", // HTML content
        textContent: article.textContent || "", // Plain text content
        excerpt: article.excerpt || "",
        byline: article.byline ?? null,
        siteName: article.siteName ?? null,
        length: article.length ?? 0,
        lang: article.lang ?? null,
      };
    } catch (error: any) {
      this.logger.error(`Failed to parse article: ${error.message}`);
      throw new Error(`Failed to parse article: ${error.message}`);
    }
  }

  /**
   * Extract and clean text content (removes HTML tags, normalizes whitespace)
   */
  cleanTextContent(textContent: string): string {
    return textContent
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
      .trim();
  }
}
