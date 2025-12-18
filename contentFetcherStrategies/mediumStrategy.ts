import { XMLParser } from "fast-xml-parser";

import { ContentFetcherStrategy, ContentItem, SinceDate } from "./contentStrategyFactory";

interface MediumRSSItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  "content:encoded": string;
}

interface MediumRSSResponse {
  rss: {
    channel: {
      item: MediumRSSItem[];
    };
  };
}

export class MediumStrategy implements ContentFetcherStrategy {
  private static readonly RSS_URL_BASE = "https://medium.com/@";
  private static readonly RSS_URL_SUFFIX = "/feed";
  private static readonly CONTENT_ID_LENGTH = 16;
  private static readonly FETCH_TIMEOUT_MS = 8000;
  private static readonly sinceDateMap = new Map<SinceDate, Date>([
    ["today", new Date()],
    ["yesterday", new Date(Date.now() - 24 * 60 * 60 * 1000)],
    ["last_week", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)],
    ["last_month", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)],
    ["last_year", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)],
  ]);

  async fetchContent(username: string, since: SinceDate): Promise<ContentItem[]> {
    const sinceDate = MediumStrategy.sinceDateMap.get(since);
    const rssUrl = this.buildRssUrl(username);
    const rssText = await this.fetchRssContent(rssUrl);

    if (!rssText) {
      return [];
    }

    return this.parseMediumRSS(rssText, sinceDate!, username);
  }

  private buildRssUrl(username: string): string {
    return new URL(
      `@${username}${MediumStrategy.RSS_URL_SUFFIX}`,
      MediumStrategy.RSS_URL_BASE,
    ).toString();
  }

  private async fetchRssContent(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      MediumStrategy.FETCH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseMediumRSS(
    rssText: string,
    sinceDate: Date,
    username: string,
  ): ContentItem[] {
    try {
      const parser = new XMLParser();
      const parsed = parser.parse(rssText) as MediumRSSResponse;
      const items = this.extractRssItems(parsed);
      
      return items
        .filter((item) => this.getItemLink(item) !== "")
        .filter((item) => this.isItemAfterDate(item, sinceDate))
        .map((item) => this.convertToContentItem(item, username)); 
    } catch {
      return [];
    }
  }

  private extractRssItems(parsed: MediumRSSResponse): MediumRSSItem[] {
    const items = parsed?.rss?.channel?.item || [];

    return Array.isArray(items) ? items : [items].filter(Boolean);
  }

  private isItemAfterDate(item: MediumRSSItem, since: Date): boolean {
    const dateStr = item.pubDate || "";
    const pubDate = new Date(dateStr);

    return !isNaN(pubDate.getTime()) && pubDate >= since;
  }

  private getItemLink(item: MediumRSSItem): string {
    return item.link.trim() || item.guid.trim() || "";
  }

  private convertToContentItem(
    item: MediumRSSItem,
    username: string,
  ): ContentItem {
    const link = this.getItemLink(item);
    const title = item.title || "";
    const description = item["content:encoded"] || "";
    const pubDate = new Date(item.pubDate || "");

    return {
      id: this.generateContentId(link),
      url: link,
      title,
      description,
      publishedAt: pubDate,
      author: username,
      type: "ARTICLES",
      platform: "MEDIUM",
    };
  }

  private generateContentId(url: string): string {
    return Buffer.from(url)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, MediumStrategy.CONTENT_ID_LENGTH);
  }
}
