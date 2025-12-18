import { MediumStrategy } from "./mediumStrategy";

export type PlatformKeys = "MEDIUM" | "X" | "INSTAGRAM";
export type ContentType = "ARTICLES";
export type SinceDate = "today" | "yesterday" | "last_week" | "last_month" | "last_year" | "all_time";

export interface ContentItem {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: Date;
  type: ContentType;
  platform: PlatformKeys;
  author: string;
}

export interface UserIntegration {
  user_id: string;
  username: string;
  platform: PlatformKeys;
}

export interface ContentFetcherStrategy {
  fetchContent(username: string, since: SinceDate): Promise<ContentItem[]>;
}

export class ContentFetcherStrategyFactory {
  private static strategies: Map<string, ContentFetcherStrategy> =
    new Map([["MEDIUM", new MediumStrategy()]]);

  static getStrategy(platformId: string): ContentFetcherStrategy {
    const strategy = this.strategies.get(platformId.toUpperCase());

    if (!strategy) {
      throw new Error(`Unsupported platform: ${platformId}`);
    }

    return strategy;
  }
}
