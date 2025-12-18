import { Redis } from "@upstash/redis";
import { createClient } from "redis";
import { config } from "../config";
import { sanitizeUrlForLog } from "./logger";

type NodeRedisClient = ReturnType<typeof createClient>;
type RedisDelArgs = Parameters<NodeRedisClient["del"]>;

type RedisLike = {
  get<T = unknown>(key: string): Promise<T | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
  scan?: (
    cursor: number | string,
    options?: { match?: string; count?: number }
  ) => Promise<[number | string, string[]]>;
  keys?: (pattern: string) => Promise<string[]>;
};

class NodeRedisAdapter implements RedisLike {
  private ready: Promise<void>;

  constructor(private client: NodeRedisClient) {
    this.ready = client.connect().then(() => {
      const url = client.options?.url ?? 'redis://localhost:6379';
      console.log(`[REDIS] Connected to ${sanitizeUrlForLog(url)}`);
    }).catch((error: Error) => {
      console.error('[REDIS] Failed to connect on first attempt:', error.message);
      throw error;
    });

    client.on("error", (error: Error) => {
      console.error("[REDIS] Connection error:", error);
    });

    client.on("reconnecting", () => {
      console.warn("[REDIS] Reconnecting...");
    });

    client.on("end", () => {
      console.warn("[REDIS] Connection closed");
    });
  }

  private async ensureConnection() {
    await this.ready;
  }

  async get<T = unknown>(key: string) {
    await this.ensureConnection();
    return this.client.get(key) as Promise<T | null>;
  }

  async setex(key: string, ttlSeconds: number, value: string) {
    await this.ensureConnection();
    return this.client.setEx(key, ttlSeconds, value) as Promise<"OK" | null>;
  }

  async del(...keys: string[]) {
    await this.ensureConnection();
    return this.client.del(...(keys as RedisDelArgs));
  }

  async ping() {
    await this.ensureConnection();
    return this.client.ping();
  }

  async scan(cursor: number | string, options?: { match?: string; count?: number }) {
    await this.ensureConnection();
    const scanOptions: Record<string, string | number> = {};
    if (options?.match) scanOptions.MATCH = options.match;
    if (options?.count) scanOptions.COUNT = options.count;

    const result = await (this.client as any).scan(cursor, scanOptions);

    if (Array.isArray(result)) {
      const [nextCursor, keys] = result as [number | string, string[]];
      return [String(nextCursor ?? '0'), keys ?? []];
    }

    if (result && typeof result === 'object' && 'cursor' in result && 'keys' in result) {
      const { cursor: nextCursor, keys } = result as { cursor?: number | string; keys?: string[] };
      return [String(nextCursor ?? '0'), keys ?? []];
    }

    return ['0', []];
  }

  async keys(pattern: string) {
    await this.ensureConnection();
    return (this.client as any).keys(pattern);
  }
}

class UpstashRedisAdapter implements RedisLike {
  constructor(private client: Redis) {}

  get<T = unknown>(key: string) {
    return this.client.get<T>(key);
  }

  setex(key: string, ttlSeconds: number, value: string) {
    return this.client.setex(key, ttlSeconds, value) as Promise<"OK" | null>;
  }

  del(...keys: string[]) {
    return this.client.del(...keys);
  }

  ping() {
    return this.client.ping();
  }

  async scan(cursor: number | string, options?: { match?: string; count?: number }) {
    const result = await (this.client as any).scan(String(cursor), {
      match: options?.match,
      count: options?.count,
    });
    const [nextCursor, keys] = result as [number | string, string[]];
    return [String(nextCursor ?? '0'), keys ?? []];
  }

  async keys(pattern: string) {
    if (typeof (this.client as any).keys === 'function') {
      return (this.client as any).keys(pattern);
    }
    throw new Error('Upstash Redis does not support KEYS; use scan instead.');
  }
}

function buildNodeRedis(): RedisLike {
  const host = config.redisHost ?? "redis";
  const port = config.redisPort ?? "6379";
  const url = config.redisUrl ?? `redis://${host}:${port}`;
  const connectTimeout = 15000;

  const client = createClient({
    url,
    socket: {
      connectTimeout,
      reconnectStrategy(retries: number) {
        const delay = Math.min(500 * 2 ** retries, 10_000);
        console.warn(`[REDIS] Reconnecting (attempt ${retries + 1}) in ${delay}ms to ${sanitizeUrlForLog(url)}`);
        return delay;
      },
    },
  });

  return new NodeRedisAdapter(client);
}

function buildUpstashRedis(): RedisLike {
  const missing: string[] = [];
  if (!config.upstashRedisRestUrl) missing.push("UPSTASH_REDIS_REST_URL");
  if (!config.upstashRedisRestToken) missing.push("UPSTASH_REDIS_REST_TOKEN");

  if (missing.length) {
    console.warn(
      `Upstash Redis environment variables are missing: ${missing.join(", ")}. Requests will likely fail.`
    );
  }

  const client = new Redis({
    url: config.upstashRedisRestUrl!,
    token: config.upstashRedisRestToken!,
  });

  console.log(`[REDIS] Using Upstash REST at ${sanitizeUrlForLog(config.upstashRedisRestUrl)}`);

  return new UpstashRedisAdapter(client);
}

const nodeEnv = config.nodeEnv ?? "development";
const hasUpstash = Boolean(config.upstashRedisRestUrl && config.upstashRedisRestToken);
const hasNodeRedis = Boolean(config.redisUrl || config.redisHost || config.redisPort);

if (nodeEnv === "production" && !hasUpstash && !hasNodeRedis) {
  throw new Error("Redis configuration is missing: set REDIS_URL (or REDIS_HOST/REDIS_PORT) or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN");
}

const redisSource: "node" | "upstash" = (() => {
  if (hasNodeRedis) return "node";
  if (hasUpstash) return "upstash";
  return nodeEnv !== "production" ? "node" : "upstash";
})();

export const redis: RedisLike = redisSource === "upstash" ? buildUpstashRedis() : buildNodeRedis();
