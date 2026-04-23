/**
 * IP Ban Middleware — Redis-backed with in-memory fallback.
 *
 * Records failed authentication attempts per IP.  After MAX_FAILURES within
 * WINDOW_MS the IP is banned for BAN_DURATION_MS.
 *
 * When REDIS_URL is set, ban state survives server restarts and is shared
 * across process instances.  Without Redis (development only), state is
 * kept in a local Map with a periodic cleanup timer.
 *
 * Redis key schema:
 *   ipban:{ip}  →  JSON-serialised FailureRecord  (TTL = BAN_DURATION_MS or WINDOW_MS)
 */

import { type Request, type Response, type NextFunction } from "express";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

interface FailureRecord {
  count: number;
  firstFailAt: number;
  bannedUntil: number | null;
}

const MAX_FAILURES = 20;
const WINDOW_MS = 15 * 60 * 1000;
const BAN_DURATION_MS = 60 * 60 * 1000;

// ── In-memory fallback ────────────────────────────────────────────────────────

const memFailures = new Map<string, FailureRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of memFailures.entries()) {
    const expired = record.bannedUntil
      ? now > record.bannedUntil
      : now - record.firstFailAt > WINDOW_MS;
    if (expired) memFailures.delete(ip);
  }
}, 5 * 60 * 1000);

// ── IP extraction ─────────────────────────────────────────────────────────────

function getIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

// ── Redis helpers ─────────────────────────────────────────────────────────────

function banKey(ip: string): string {
  return `ipban:${ip}`;
}

async function redisGetRecord(ip: string): Promise<FailureRecord | null> {
  try {
    const raw = await redis!.get(banKey(ip));
    if (!raw) return null;
    return JSON.parse(raw) as FailureRecord;
  } catch (err) {
    logger.error({ err }, "Redis GET failed in ipBan");
    return null;
  }
}

async function redisSetRecord(ip: string, record: FailureRecord): Promise<void> {
  const ttlMs = record.bannedUntil
    ? record.bannedUntil - Date.now()
    : WINDOW_MS - (Date.now() - record.firstFailAt);
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  try {
    await redis!.set(banKey(ip), JSON.stringify(record), "EX", ttlSec);
  } catch (err) {
    logger.error({ err }, "Redis SET failed in ipBan");
  }
}

async function redisDelRecord(ip: string): Promise<void> {
  try {
    await redis!.del(banKey(ip));
  } catch (err) {
    logger.error({ err }, "Redis DEL failed in ipBan");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call when an auth attempt fails — increments failure counter for the IP. */
export async function recordFailedAttempt(req: Request): Promise<void> {
  const ip = getIp(req);
  const now = Date.now();

  if (redis) {
    const record = (await redisGetRecord(ip)) ?? { count: 0, firstFailAt: now, bannedUntil: null };

    if (now - record.firstFailAt > WINDOW_MS) {
      record.count = 0;
      record.firstFailAt = now;
      record.bannedUntil = null;
    }

    record.count += 1;
    if (record.count >= MAX_FAILURES) {
      record.bannedUntil = now + BAN_DURATION_MS;
      logger.warn({ ip, failures: record.count }, "IP temporarily banned for excessive auth failures");
    }

    await redisSetRecord(ip, record);
  } else {
    const record = memFailures.get(ip) ?? { count: 0, firstFailAt: now, bannedUntil: null };

    if (now - record.firstFailAt > WINDOW_MS) {
      record.count = 0;
      record.firstFailAt = now;
      record.bannedUntil = null;
    }

    record.count += 1;
    if (record.count >= MAX_FAILURES) {
      record.bannedUntil = now + BAN_DURATION_MS;
      logger.warn({ ip, failures: record.count }, "IP temporarily banned for excessive auth failures");
    }

    memFailures.set(ip, record);
  }
}

/** Call when an auth attempt succeeds — reset failure counter for the IP. */
export async function clearFailedAttempts(req: Request): Promise<void> {
  const ip = getIp(req);
  if (redis) {
    await redisDelRecord(ip);
  } else {
    memFailures.delete(ip);
  }
}

/** Middleware — blocks requests from temporarily banned IPs. */
export async function checkIpBan(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = getIp(req);

  const record = redis ? await redisGetRecord(ip) : (memFailures.get(ip) ?? null);

  if (record?.bannedUntil && Date.now() < record.bannedUntil) {
    const retryAfterSec = Math.ceil((record.bannedUntil - Date.now()) / 1000);
    logger.warn({ ip }, "Blocked request from banned IP");
    res
      .status(429)
      .setHeader("Retry-After", retryAfterSec)
      .json({ error: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).` });
    return;
  }

  next();
}
