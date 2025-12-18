import { MediumStrategy } from "./mediumStrategy";

export type FollowingUser = {
  fullName: string;
  username: string;
  profileUrl: string;
  profilePictureUrl?: string;
};

export type CachedFollowingsDTO = {
  followings: Array<FollowingUser>;
  fetchedAt: Date;
};

export interface FollowingFetcherStrategy {
  isUserExists(username: string): Promise<boolean>;
  getFollowings(username: string): Promise<FollowingUser[]>;
}

export class FollowingFetcherStrategyFactory {
  private static strategies: Map<string, FollowingFetcherStrategy> = new Map([
    ["MEDIUM", new MediumStrategy()],
  ]);

  static getStrategy(platformId: string): FollowingFetcherStrategy {
    const strategy = this.strategies.get(platformId.toUpperCase());

    if (!strategy) {
      throw new Error(`Unsupported platform: ${platformId}`);
    }

    return strategy;
  }
}
