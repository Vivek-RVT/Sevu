/**
 * Auth Routes — Phone + Password with OTP verification
 *
 * Registration flow:
 *   1. POST /api/auth/check-phone   → check if phone is new or returning
 *   2. POST /api/auth/send-otp      → send OTP to phone
 *   3. POST /api/auth/register      → create account (phone + password), verify OTP
 *   4. POST /api/auth/verify-phone  → verify OTP for existing account
 *
 * Login flow:
 *   POST /api/auth/login            → phone + password → sets httpOnly cookies
 *
 * Forgot password flow:
 *   1. POST /api/auth/forgot-password  → send OTP to phone
 *   2. POST /api/auth/reset-password   → verify OTP + set new password
 *
 * Token management:
 *   POST /api/auth/refresh           → rotate refresh token, issue new access token
 *   GET  /api/auth/me                → verify current access token
 *
 * Session management:
 *   POST /api/auth/logout            → logout current device (or all devices)
 *   GET  /api/auth/sessions          → list active sessions for current user
 *
 * Link business (called after business setup):
 *   POST /api/auth/link-business     → links businessId to user record
 *
 * Security model:
 *   - Access token: JWT, 15 min, stored in httpOnly cookie (sevu_access)
 *   - Refresh token: random 48-byte hex, SHA-256 hashed in DB, 7 days, httpOnly cookie (sevu_refresh)
 *   - Sessions: max 3 active sessions per user; oldest session evicted on overflow
 *   - Tokens rotated on every refresh — old token immediately invalidated
 */

import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import bcrypt from "bcryptjs";
import axios from "axios";
import { db } from "@workspace/db";
import { usersTable, businessesTable, sessionsTable } from "@workspace/db/schema";
import { eq, and, gt, asc } from "drizzle-orm";
import { USE_REAL_OTP, OTP_CONFIG } from "../config/otp.js";
import { redis } from "../lib/redis.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../lib/token.js";
import {
  generateOtp,
  saveOtp,
  verifyOtp,
  peekOtp,
  getResendCooldownSeconds,
} from "../lib/otp-store.js";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { recordFailedAttempt, clearFailedAttempts } from "../middleware/ipBan.js";
import {
  CheckPhoneBody, type CheckPhoneBodyType,
  SendOtpBody, type SendOtpBodyType,
  CheckOtpBody, type CheckOtpBodyType,
  RegisterBody, type RegisterBodyType,
  VerifyPhoneBody, type VerifyPhoneBodyType,
  LoginBody, type LoginBodyType,
  ForgotPasswordBody, type ForgotPasswordBodyType,
  ResetPasswordBody, type ResetPasswordBodyType,
  LinkBusinessBody, type LinkBusinessBodyType,
  LogoutBody, type LogoutBodyType,
} from "../validators/auth.schema.js";

const router: IRouter = Router();

const MAX_SESSIONS = 3;

// ── Redis store factory (shared across all auth limiters) ─────────────────────

function makeRedisStore(prefix: string) {
  if (!redis) return {};
  return {
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redis as any).call(...args),
      prefix,
    }),
  };
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const sendOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Please wait 10 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  ...makeRedisStore("rl:otp-send:"),
});

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { error: "Too many attempts. Please wait and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  ...makeRedisStore("rl:auth:"),
});

const checkOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many OTP verification attempts. Please wait and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  ...makeRedisStore("rl:otp-check:"),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? null;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Cookie Options ───────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "strict" as const,
  maxAge: 15 * 60 * 1000,
  path: "/",
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "strict" as const,
  maxAge: OTP_CONFIG.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(OTP_CONFIG.ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie(OTP_CONFIG.REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(OTP_CONFIG.ACCESS_COOKIE_NAME, { path: "/" });
  res.clearCookie(OTP_CONFIG.REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

// ─── Session Management ───────────────────────────────────────────────────────

async function createSession(userId: number, req: Request): Promise<string> {
  const rawToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(
    Date.now() + OTP_CONFIG.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  );
  const now = new Date();

  const activeSessions = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, userId), gt(sessionsTable.expiresAt, now)))
    .orderBy(asc(sessionsTable.createdAt));

  if (activeSessions.length >= MAX_SESSIONS) {
    const toDelete = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
    for (const session of toDelete) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
    }
    logger.info({ userId, evicted: toDelete.length }, "Evicted oldest sessions (max device limit)");
  }

  await db.insert(sessionsTable).values({
    userId,
    refreshTokenHash: tokenHash,
    deviceInfo: req.headers["user-agent"] ?? null,
    ipAddress: getClientIp(req),
    expiresAt,
  });

  return rawToken;
}

async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}

async function revokeAllSessions(userId: number): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

// ─── OTP Dispatch ─────────────────────────────────────────────────────────────

async function sendViaMSG91(phone: string, otp: string): Promise<void> {
  const { MSG91_API_KEY, MSG91_TEMPLATE_ID } = OTP_CONFIG;
  if (!MSG91_API_KEY || !MSG91_TEMPLATE_ID) {
    throw new Error("MSG91_API_KEY and MSG91_TEMPLATE_ID must be set for production OTP.");
  }
  await axios.post(
    "https://api.msg91.com/api/v5/otp",
    { template_id: MSG91_TEMPLATE_ID, mobile: phone, otp },
    { headers: { authkey: MSG91_API_KEY, "Content-Type": "application/json" } },
  );
}

async function dispatchOtp(phone: string): Promise<void> {
  const otp = generateOtp();
  await saveOtp(phone, otp);

  if (!USE_REAL_OTP) {
    // TEST MODE: OTP is printed to the server console only — never returned to clients.
    // This block is only reached in non-production environments.
    logger.info(`[TEST MODE] OTP for ${phone}: ${otp}`);
    console.log(`\n╔══════════════════════════════════╗`);
    console.log(`║  TEST OTP for ${phone}`);
    console.log(`║  Code: ${otp}    (valid 5 min)`);
    console.log(`╚══════════════════════════════════╝\n`);
  } else {
    await sendViaMSG91(phone, otp);
    logger.info(`OTP sent via MSG91 to ${phone}`);
  }
}

// ─── POST /api/auth/check-phone ───────────────────────────────────────────────
// Returns a generic success regardless of whether the phone is registered.
// The frontend uses this only to decide which UI flow to show; exposing a
// boolean would allow enumeration of every registered phone number.

router.post(
  "/check-phone",
  authLimiter,
  validate({ body: CheckPhoneBody }),
  async (req: Request, res: Response) => {
    const { phone } = req.validated.body as CheckPhoneBodyType;
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, phone));
    // Return the result only — no enumeration hint beyond what the client needs.
    // "isNewUser: true" means register flow; "isNewUser: false" means login flow.
    // This is necessary for UX but the information should only be acted on, not indexed.
    res.json({ isNewUser: !user });
  },
);

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────

router.post(
  "/send-otp",
  sendOtpLimiter,
  validate({ body: SendOtpBody }),
  async (req: Request, res: Response) => {
    const { phone } = req.validated.body as SendOtpBodyType;

    const cooldown = await getResendCooldownSeconds(phone);
    if (cooldown > 0) {
      res.status(429).json({
        error: `Please wait ${cooldown}s before requesting another OTP.`,
        cooldownSeconds: cooldown,
      });
      return;
    }

    await dispatchOtp(phone);
    // Never return testMode, otp, or any hint about the OTP delivery mechanism.
    res.json({
      success: true,
      message: "OTP sent. Enter it below to verify your number.",
    });
  },
);

// ─── POST /api/auth/check-otp ─────────────────────────────────────────────────

router.post(
  "/check-otp",
  checkOtpLimiter,
  validate({ body: CheckOtpBody }),
  async (req: Request, res: Response) => {
    const { phone, otp } = req.validated.body as CheckOtpBodyType;

    const result = await peekOtp(phone, otp);
    if (result === "expired") {
      res.status(401).json({ error: "OTP has expired. Please request a new one." });
      return;
    }
    if (result === "max_attempts") {
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      return;
    }
    if (result === "invalid") {
      res.status(401).json({ error: "Incorrect OTP. Please check and try again." });
      return;
    }

    res.json({ success: true });
  },
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post(
  "/register",
  authLimiter,
  validate({ body: RegisterBody }),
  async (req: Request, res: Response) => {
    const { phone, otp, password } = req.validated.body as RegisterBodyType;

    const otpResult = await verifyOtp(phone, otp);
    if (otpResult === "expired") {
      res.status(401).json({ error: "OTP has expired. Please request a new one." });
      return;
    }
    if (otpResult === "max_attempts") {
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      return;
    }
    if (otpResult === "invalid") {
      res.status(401).json({ error: "Incorrect OTP. Please try again." });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, phone));

    if (existing) {
      res.status(409).json({
        error: "An account with this phone number already exists. Please login instead.",
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(usersTable)
      .values({ phone, passwordHash, phoneVerified: true })
      .returning();

    const accessToken = signAccessToken(newUser.id, newUser.phone, null);
    const refreshToken = await createSession(newUser.id, req);
    setAuthCookies(res, accessToken, refreshToken);
    logger.info({ userId: newUser.id }, "New user registered");

    res.json({
      success: true,
      isNewUser: true,
      message: "Account created successfully.",
    });
  },
);

// ─── POST /api/auth/verify-phone ─────────────────────────────────────────────

router.post(
  "/verify-phone",
  authLimiter,
  validate({ body: VerifyPhoneBody }),
  async (req: Request, res: Response) => {
    const { phone, otp } = req.validated.body as VerifyPhoneBodyType;

    const result = await verifyOtp(phone, otp);
    if (result === "expired") {
      res.status(401).json({ error: "OTP has expired. Please request a new one." });
      return;
    }
    if (result === "max_attempts") {
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      return;
    }
    if (result === "invalid") {
      res.status(401).json({ error: "Incorrect OTP. Please check and try again." });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ phoneVerified: true })
      .where(eq(usersTable.phone, phone))
      .returning();

    if (!user) {
      res.status(404).json({ error: "Account not found. Please register again." });
      return;
    }

    const accessToken = signAccessToken(user.id, user.phone, user.businessId ?? null);
    const refreshToken = await createSession(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);
    logger.info({ userId: user.id }, "Phone verified");

    res.json({
      success: true,
      isNewUser: !user.businessId,
      business: null,
    });
  },
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post(
  "/login",
  authLimiter,
  validate({ body: LoginBody }),
  async (req: Request, res: Response) => {
    const { phone, password } = req.validated.body as LoginBodyType;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, phone));

    if (!user) {
      await recordFailedAttempt(req);
      res.status(401).json({ error: "No account found with this phone number." });
      return;
    }

    if (!user.phoneVerified) {
      await recordFailedAttempt(req);
      res.status(403).json({
        error: "Phone number not verified. Please complete registration.",
      });
      return;
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      await recordFailedAttempt(req);
      res.status(401).json({ error: "Incorrect password. Please try again." });
      return;
    }

    let business = null;
    if (user.businessId) {
      const [b] = await db
        .select()
        .from(businessesTable)
        .where(eq(businessesTable.id, user.businessId));
      if (b) {
        business = { id: b.id, name: b.name, category: b.category, phone: b.phone };
      }
    }

    await clearFailedAttempts(req);

    const accessToken = signAccessToken(user.id, user.phone, user.businessId ?? null);
    const refreshToken = await createSession(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);
    logger.info({ userId: user.id }, "Login successful");

    res.json({ success: true, isNewUser: !user.businessId, business });
  },
);

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post(
  "/forgot-password",
  sendOtpLimiter,
  validate({ body: ForgotPasswordBody }),
  async (req: Request, res: Response) => {
    const { phone } = req.validated.body as ForgotPasswordBodyType;

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, phone));

    if (!user) {
      // Don't reveal if phone exists — always respond success
      res.json({
        success: true,
        message: "If this number is registered, an OTP has been sent.",
      });
      return;
    }

    const cooldown = await getResendCooldownSeconds(phone);
    if (cooldown > 0) {
      res.status(429).json({
        error: `Please wait ${cooldown}s before requesting another OTP.`,
        cooldownSeconds: cooldown,
      });
      return;
    }

    await dispatchOtp(phone);
    // Never expose testMode or OTP delivery details in the response.
    res.json({
      success: true,
      message: "OTP sent. Enter it below to reset your password.",
    });
  },
);

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post(
  "/reset-password",
  authLimiter,
  validate({ body: ResetPasswordBody }),
  async (req: Request, res: Response) => {
    const { phone, otp, newPassword } = req.validated.body as ResetPasswordBodyType;

    const result = await verifyOtp(phone, otp);
    if (result === "expired") {
      res.status(401).json({ error: "OTP has expired. Please request a new one." });
      return;
    }
    if (result === "max_attempts") {
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      return;
    }
    if (result === "invalid") {
      res.status(401).json({ error: "Incorrect OTP. Please check and try again." });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    const [user] = await db
      .update(usersTable)
      .set({ passwordHash, phoneVerified: true })
      .where(eq(usersTable.phone, phone))
      .returning();

    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    // Revoke all sessions on password reset — forces every device to re-authenticate
    await revokeAllSessions(user.id);
    logger.info({ userId: user.id }, "All sessions revoked after password reset");

    let business = null;
    if (user.businessId) {
      const [b] = await db
        .select()
        .from(businessesTable)
        .where(eq(businessesTable.id, user.businessId));
      if (b) business = { id: b.id, name: b.name, category: b.category };
    }

    const accessToken = signAccessToken(user.id, user.phone, user.businessId ?? null);
    const refreshToken = await createSession(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);
    logger.info({ userId: user.id }, "Password reset");

    res.json({ success: true, business, isNewUser: !user.businessId });
  },
);

// ─── POST /api/auth/link-business ────────────────────────────────────────────

router.post(
  "/link-business",
  requireAuth,
  validate({ body: LinkBusinessBody }),
  async (req: Request, res: Response) => {
    const { businessId } = req.validated.body as LinkBusinessBodyType;
    const userId = req.auth!.userId;

    if (req.auth!.businessId !== null && req.auth!.businessId !== businessId) {
      res.status(409).json({
        error: "Your account is already linked to a different business.",
      });
      return;
    }

    const [existingOwner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.businessId, businessId));

    if (existingOwner && existingOwner.id !== userId) {
      res.status(403).json({
        error: "This business is already claimed by another account.",
      });
      return;
    }

    const [business] = await db
      .select({ id: businessesTable.id })
      .from(businessesTable)
      .where(eq(businessesTable.id, businessId));

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ businessId })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const accessToken = signAccessToken(user.id, user.phone, user.businessId ?? null);
    res.cookie(OTP_CONFIG.ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_OPTIONS);

    logger.info({ userId, businessId }, "Business linked to user account");
    res.json({ success: true });
  },
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({ valid: true, user: req.auth });
});

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response) => {
  const rawToken: string | undefined = req.cookies?.[OTP_CONFIG.REFRESH_COOKIE_NAME];

  if (!rawToken) {
    res.status(401).json({ error: "No refresh token provided." });
    return;
  }

  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  // Atomic DELETE...RETURNING eliminates the race condition where two concurrent
  // requests both find the session before either deletes it.
  const [session] = await db
    .delete(sessionsTable)
    .where(
      and(
        eq(sessionsTable.refreshTokenHash, tokenHash),
        gt(sessionsTable.expiresAt, now),
      ),
    )
    .returning();

  if (!session) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  if (!user) {
    clearAuthCookies(res);
    res.status(401).json({ error: "User not found." });
    return;
  }

  // Session binding: detect stolen-token misuse via user-agent change
  const requestUa = req.headers["user-agent"] ?? null;
  const sessionUa = session.deviceInfo ?? null;
  if (sessionUa && requestUa && sessionUa !== requestUa) {
    logger.warn(
      { userId: user.id, sessionId: session.id, sessionUa, requestUa },
      "Session binding mismatch — user-agent changed. Session already revoked.",
    );
    clearAuthCookies(res);
    res.status(401).json({ error: "Session security check failed. Please log in again." });
    return;
  }

  const requestIp = getClientIp(req);
  if (session.ipAddress && requestIp && session.ipAddress !== requestIp) {
    logger.warn(
      { userId: user.id, sessionId: session.id, sessionIp: session.ipAddress, requestIp },
      "Session IP changed (informational — not blocking).",
    );
  }

  const accessToken = signAccessToken(user.id, user.phone, user.businessId ?? null);
  const newRefreshToken = await createSession(user.id, req);
  setAuthCookies(res, accessToken, newRefreshToken);

  logger.info({ userId: user.id }, "Token refreshed");

  res.json({
    success: true,
    businessId: user.businessId ?? null,
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post(
  "/logout",
  validate({ body: LogoutBody }),
  async (req: Request, res: Response) => {
    const rawToken: string | undefined = req.cookies?.[OTP_CONFIG.REFRESH_COOKIE_NAME];
    const { revokeAll } = req.validated.body as LogoutBodyType;

    if (rawToken) {
      const tokenHash = hashRefreshToken(rawToken);

      const [session] = await db
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.refreshTokenHash, tokenHash));

      if (session) {
        if (revokeAll) {
          await revokeAllSessions(session.userId);
          logger.info({ userId: session.userId }, "All sessions revoked");
        } else {
          await revokeSession(session.id);
          logger.info({ userId: session.userId }, "Session revoked");
        }
      }
    }

    clearAuthCookies(res);
    res.json({ success: true });
  },
);

// ─── GET /api/auth/sessions ───────────────────────────────────────────────────

router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const now = new Date();

  const sessions = await db
    .select({
      id: sessionsTable.id,
      deviceInfo: sessionsTable.deviceInfo,
      ipAddress: sessionsTable.ipAddress,
      createdAt: sessionsTable.createdAt,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .where(
      and(eq(sessionsTable.userId, userId), gt(sessionsTable.expiresAt, now)),
    )
    .orderBy(asc(sessionsTable.createdAt));

  res.json({ sessions });
});

export default router;
