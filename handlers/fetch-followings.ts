import { FollowingFetcherStrategyFactory } from "../followingFetcherStrategies/followingFetcherFactory";
import { APIGatewayEvent } from "aws-lambda";

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

  try { 
    const followings = await fetchingStrategy.getFollowings(username);

    return {
      statusCode: 200,
      body: JSON.stringify({ followings }),
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
