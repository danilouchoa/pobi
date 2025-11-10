import { redis } from "./redisClient";

export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  const cached = await redis.get<string>(key);
  if (cached) {
    console.log(`[CACHE HIT] ${key}`);
    try {
      return JSON.parse(cached) as T;
    } catch {
      return cached as unknown as T;
    }
  }

  const fresh = await fetchFn();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  console.log(`[CACHE MISS] ${key} → stored`);
  return fresh;
}
