import { Redis } from "@upstash/redis";
import { createClient } from "redis";
import { sanitizeUrlForLog } from "./logger";

type NodeRedisClient = ReturnType<typeof createClient>;
type RedisDelArgs = Parameters<NodeRedisClient["del"]>;

type RedisLike = {
  get<T = unknown>(key: string): Promise<T | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
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
}

function buildNodeRedis(): RedisLike {
  const host = process.env.REDIS_HOST ?? "redis";
  const port = process.env.REDIS_PORT ?? "6379";
  const url = process.env.REDIS_URL ?? `redis://${host}:${port}`;
  const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "15000");

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
  const requiredEnv = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length) {
    console.warn(
      `Upstash Redis environment variables are missing: ${missing.join(", ")}. Requests will likely fail.`
    );
  }

  const client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  console.log(`[REDIS] Using Upstash REST at ${sanitizeUrlForLog(process.env.UPSTASH_REDIS_REST_URL)}`);

  return new UpstashRedisAdapter(client);
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const hasNodeRedis = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT);

if (nodeEnv === "production" && !hasUpstash && !hasNodeRedis) {
  throw new Error("Redis configuration is missing: set REDIS_URL (or REDIS_HOST/REDIS_PORT) or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN");
}

const redisSource: "node" | "upstash" = (() => {
  if (hasNodeRedis) return "node";
  if (hasUpstash) return "upstash";
  return nodeEnv !== "production" ? "node" : "upstash";
})();

export const redis: RedisLike = redisSource === "upstash" ? buildUpstashRedis() : buildNodeRedis();
