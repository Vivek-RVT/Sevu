/**
 * OTP Authentication Configuration
 *
 * USE_REAL_OTP is controlled exclusively via the USE_REAL_OTP environment variable.
 *   USE_REAL_OTP=false (default) → TEST MODE: OTP is generated locally and
 *     logged to the server console (dev only). No SMS is sent.
 *   USE_REAL_OTP=true → PRODUCTION MODE: OTP is sent via MSG91 SMS API.
 *
 * NEVER set this in source code. Use the environment variable.
 */

export const USE_REAL_OTP = process.env.USE_REAL_OTP === "true";

const KNOWN_INSECURE_DEFAULT = "sevu-dev-secret-change-in-production";

const rawJwtSecret = process.env.JWT_SECRET;

// ── JWT Secret Hardening ─────────────────────────────────────────────────────
// In production the JWT_SECRET MUST be a strong, randomly generated secret set
// via an environment variable.  If the secret is absent or equals the insecure
// development default, the server refuses to start.
if (process.env.NODE_ENV === "production") {
  if (!rawJwtSecret || rawJwtSecret === KNOWN_INSECURE_DEFAULT) {
    console.error(
      "[FATAL] JWT_SECRET is not set or is the insecure development default. " +
      "Set a strong random secret via the JWT_SECRET environment variable before starting in production.",
    );
    process.exit(1);
  }
  if (rawJwtSecret.length < 32) {
    console.error(
      "[FATAL] JWT_SECRET is too short (minimum 32 characters). " +
      "Use a cryptographically random string of at least 64 characters.",
    );
    process.exit(1);
  }
}

export const OTP_CONFIG = {
  /** OTP validity period in milliseconds (5 minutes) */
  EXPIRY_MS: 5 * 60 * 1000,

  /** Minimum wait before a resend is allowed (30 seconds) */
  RESEND_COOLDOWN_MS: 30 * 1000,

  /** OTP digit length */
  LENGTH: 6,

  /**
   * JWT secret — MUST be overridden in production via JWT_SECRET env var.
   * Falls back to the insecure dev default only in non-production environments.
   */
  JWT_SECRET: rawJwtSecret || KNOWN_INSECURE_DEFAULT,

  /** Short-lived access token — 15 minutes */
  JWT_EXPIRES_IN: "15m",

  /** Access token httpOnly cookie name */
  ACCESS_COOKIE_NAME: "sevu_access",

  /** Refresh token cookie name */
  REFRESH_COOKIE_NAME: "sevu_refresh",

  /** Refresh token validity — 7 days */
  REFRESH_TOKEN_EXPIRES_DAYS: 7,

  /** MSG91 credentials (only used when USE_REAL_OTP = true) */
  MSG91_API_KEY: process.env.MSG91_API_KEY || "",
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || "",
};
