import {
  FollowingFetcherStrategyFactory,
  CachedFollowingsDTO,
} from "../followingFetcherStrategies/followingFetcherFactory";
import { APIGatewayEvent } from "aws-lambda";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const handler = async (
  event: APIGatewayEvent,
) => {
  const { platformName, username } = event.pathParameters as { platformName: string, username: string };

  const fetchingStrategy = FollowingFetcherStrategyFactory.getStrategy(platformName);
  
  const isUserExists = await fetchingStrategy.isUserExists(username);
  if (!isUserExists) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "user not found" }),
    }
  }

  const cachedFollowings = await redis.get<CachedFollowingsDTO>(`followings:${platformName}:${username}`);
  if (cachedFollowings) {
    const { followings, fetchedAt } = cachedFollowings;
    return {
      statusCode: 200,
      body: JSON.stringify({
        followings,
        fetchedAt,
      }),
    };
  }

  try { 
    const followings = await fetchingStrategy.getFollowings(username);

    const fetchedAt = new Date();
    await redis.set<CachedFollowingsDTO>(
      `followings:${platformName}:${username}`,
      { followings, fetchedAt },
      { ex: 24 * 60 * 60 },
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        followings,
        fetchedAt,
      }),
    };
  } catch (err) {
    console.error("fetchFollowings error", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
    };
  }
};

export {
  handler,
};
