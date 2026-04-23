/**
 * OTP Store — Redis-backed with in-memory fallback.
 *
 * When REDIS_URL is set, all OTP state survives server restarts and is shared
 * across process instances.  Without Redis (development only), the original
 * in-memory Map is used with a startup warning.
 *
 * Redis key schema:
 *   otp:{phone}  →  JSON-serialised OtpRecord  (TTL = EXPIRY_MS)
 *
 * Note: The resend-cooldown window is embedded in the record's `sentAt` field;
 * no separate Redis key is needed.
 */

import { randomInt } from "crypto";
import { OTP_CONFIG } from "../config/otp.js";
import { redis } from "./redis.js";
import { logger } from "./logger.js";

const MAX_ATTEMPTS = 5;
const TTL_SECONDS = Math.ceil(OTP_CONFIG.EXPIRY_MS / 1000);

interface OtpRecord {
  code: string;
  createdAt: number;
  sentAt: number;
  attempts: number;
}

// ── In-memory fallback (development only) ────────────────────────────────────

const memStore = new Map<string, OtpRecord>();

// ── Low-level helpers ─────────────────────────────────────────────────────────

function otpKey(phone: string): string {
  return `otp:${phone}`;
}

async function redisGet(phone: string): Promise<OtpRecord | null> {
  try {
    const raw = await redis!.get(otpKey(phone));
    if (!raw) return null;
    return JSON.parse(raw) as OtpRecord;
  } catch (err) {
    logger.error({ err }, "Redis GET failed in OTP store");
    return null;
  }
}

async function redisSet(phone: string, record: OtpRecord): Promise<void> {
  try {
    await redis!.set(otpKey(phone), JSON.stringify(record), "EX", TTL_SECONDS);
  } catch (err) {
    logger.error({ err }, "Redis SET failed in OTP store");
  }
}

async function redisDel(phone: string): Promise<void> {
  try {
    await redis!.del(otpKey(phone));
  } catch (err) {
    logger.error({ err }, "Redis DEL failed in OTP store");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Save (or overwrite) an OTP for the given phone number. */
export async function saveOtp(phone: string, code: string): Promise<void> {
  const now = Date.now();
  const record: OtpRecord = { code, createdAt: now, sentAt: now, attempts: 0 };

  if (redis) {
    await redisSet(phone, record);
  } else {
    memStore.set(phone, record);
  }
}

/** Returns seconds remaining in the resend cooldown, or 0 if cooldown has passed. */
export async function getResendCooldownSeconds(phone: string): Promise<number> {
  const record = redis ? await redisGet(phone) : (memStore.get(phone) ?? null);
  if (!record) return 0;

  const elapsed = Date.now() - record.sentAt;
  const remaining = OTP_CONFIG.RESEND_COOLDOWN_MS - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Verify a submitted OTP against the stored record (consuming it on success).
 * Returns:
 *   "valid"        — matches, not expired
 *   "expired"      — record expired
 *   "max_attempts" — attempt limit reached
 *   "invalid"      — wrong code
 */
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<"valid" | "expired" | "max_attempts" | "invalid"> {
  if (redis) {
    return redisVerify(phone, code, true);
  }
  return memVerify(phone, code, true);
}

/**
 * Check an OTP without consuming it (peek).
 * Still increments the attempt counter on wrong codes.
 */
export async function peekOtp(
  phone: string,
  code: string,
): Promise<"valid" | "expired" | "max_attempts" | "invalid"> {
  if (redis) {
    return redisVerify(phone, code, false);
  }
  return memVerify(phone, code, false);
}

// ── Internal verify logic ─────────────────────────────────────────────────────

async function redisVerify(
  phone: string,
  code: string,
  consume: boolean,
): Promise<"valid" | "expired" | "max_attempts" | "invalid"> {
  const record = await redisGet(phone);
  if (!record) return "invalid";

  const isExpired = Date.now() - record.createdAt > OTP_CONFIG.EXPIRY_MS;
  if (isExpired) {
    await redisDel(phone);
    return "expired";
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    if (consume) await redisDel(phone);
    return "max_attempts";
  }

  if (record.code !== code) {
    record.attempts += 1;
    await redisSet(phone, record);
    return "invalid";
  }

  if (consume) {
    await redisDel(phone);
  }
  return "valid";
}

function memVerify(
  phone: string,
  code: string,
  consume: boolean,
): "valid" | "expired" | "max_attempts" | "invalid" {
  const record = memStore.get(phone);
  if (!record) return "invalid";

  const isExpired = Date.now() - record.createdAt > OTP_CONFIG.EXPIRY_MS;
  if (isExpired) {
    memStore.delete(phone);
    return "expired";
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    if (consume) memStore.delete(phone);
    return "max_attempts";
  }

  if (record.code !== code) {
    record.attempts += 1;
    memStore.set(phone, record);
    return "invalid";
  }

  if (consume) {
    memStore.delete(phone);
  }
  return "valid";
}

/** Generate a cryptographically random N-digit OTP string (zero-padded). */
export function generateOtp(length = OTP_CONFIG.LENGTH): string {
  const max = Math.pow(10, length);
  const value = randomInt(0, max);
  return value.toString().padStart(length, "0");
}
