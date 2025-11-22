import { Redis } from "@upstash/redis";
import { createClient, RedisClientType } from "redis";

type RedisLike = {
  get<T = unknown>(key: string): Promise<T | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
  scanIterator(options?: { match?: string; count?: number }): AsyncIterableIterator<string>;
};

class NodeRedisAdapter implements RedisLike {
  private ready: Promise<void>;

  constructor(private client: RedisClientType) {
    this.ready = client.connect();

    client.on("error", (error) => {
      console.error("[REDIS] Connection error:", error);
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
    return this.client.setEx(key, ttlSeconds, value);
  }

  async del(...keys: string[]) {
    await this.ensureConnection();
    return this.client.del(...keys);
  }

  async ping() {
    await this.ensureConnection();
    return this.client.ping();
  }

  scanIterator(options?: { match?: string; count?: number }) {
    return this.client.scanIterator(options);
  }
}

class UpstashRedisAdapter implements RedisLike {
  constructor(private client: Redis) {}

  get<T = unknown>(key: string) {
    return this.client.get<T>(key);
  }

  setex(key: string, ttlSeconds: number, value: string) {
    return this.client.setex(key, ttlSeconds, value);
  }

  del(...keys: string[]) {
    return this.client.del(...keys);
  }

  ping() {
    return this.client.ping();
  }

  scanIterator(options?: { match?: string; count?: number }) {
    return this.client.scanIterator(options);
  }
}

function buildNodeRedis(): RedisLike {
  const host = process.env.REDIS_HOST ?? "redis";
  const port = process.env.REDIS_PORT ?? "6379";
  const url = process.env.REDIS_URL ?? `redis://${host}:${port}`;

  const client = createClient({ url });
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

  return new UpstashRedisAdapter(client);
}

const useLocalRedis = process.env.REDIS_URL || process.env.REDIS_HOST;

export const redis: RedisLike = useLocalRedis ? buildNodeRedis() : buildUpstashRedis();
