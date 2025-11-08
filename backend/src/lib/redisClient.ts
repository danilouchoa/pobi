import { Redis } from "@upstash/redis";

const requiredEnv = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.warn(
    `Upstash Redis environment variables are missing: ${missing.join(", ")}. Requests will likely fail.`
  );
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
