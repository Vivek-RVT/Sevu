/**
 * Redis client singleton.
 *
 * In production: REDIS_URL must be set — the server emits a startup warning
 * but continues so callers can decide how to handle a missing Redis.
 * Each subsystem (OTP store, IP ban, rate limiter) enforces its own policy.
 *
 * In development: falls back gracefully when REDIS_URL is absent.
 */

import Redis from "ioredis";
import { logger } from "./logger.js";

let _client: Redis | null = null;
let _initAttempted = false;

export function getRedisClient(): Redis | null {
  if (_initAttempted) return _client;
  _initAttempted = true;

  const url = process.env.REDIS_URL;

  if (!url) {
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        "REDIS_URL is not set. OTP store, IP ban, and rate limiting will use " +
        "in-memory state that resets on server restart. Set REDIS_URL for production resilience.",
      );
    }
    return null;
  }

  try {
    _client = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: false,
    });

    _client.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });

    _client.on("connect", () => {
      logger.info("Redis connected");
    });

    return _client;
  } catch (err) {
    logger.error({ err }, "Failed to initialise Redis client");
    _client = null;
    return null;
  }
}

/** Convenience accessor — returns null when Redis is unavailable. */
export const redis = getRedisClient();
