import { redis } from "./redis.js";
import { logger } from "./logger.js";

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn({ err, key }, "Cache GET error");
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch (err) {
    logger.warn({ err, key }, "Cache SET error");
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || !keys.length) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "Cache DEL error");
  }
}

export const CacheTTL = {
  DASHBOARD: 30,
  BUSINESS: 300,
  PROFILE: 60,
} as const;
