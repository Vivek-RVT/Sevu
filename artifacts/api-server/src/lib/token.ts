/**
 * Token Generation and Hashing Utilities
 *
 * - Access token: short-lived JWT (15 min), set in httpOnly cookie
 * - Refresh token: random 48-byte hex string, SHA-256 hashed before DB storage
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OTP_CONFIG } from "../config/otp.js";

export interface AccessTokenPayload {
  userId: number;
  phone: string;
  businessId: number | null;
}

/** Generate a signed JWT access token. */
export function signAccessToken(
  userId: number,
  phone: string,
  businessId: number | null,
): string {
  return jwt.sign(
    { userId, phone, businessId },
    OTP_CONFIG.JWT_SECRET,
    { expiresIn: OTP_CONFIG.JWT_EXPIRES_IN as any },
  );
}

/** Verify a JWT access token and return the payload. Throws on invalid/expired. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, OTP_CONFIG.JWT_SECRET) as AccessTokenPayload;
}

/** Generate a cryptographically random refresh token string. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** SHA-256 hash a refresh token before storing in the DB. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
