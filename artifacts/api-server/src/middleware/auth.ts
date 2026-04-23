import { type Request, type Response, type NextFunction } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/token.js";
import { OTP_CONFIG } from "../config/otp.js";

export interface AuthPayload {
  userId: number;
  phone: string;
  businessId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Reads the access token exclusively from the httpOnly cookie (sevu_access).
 *
 * The Bearer-header fallback that previously existed here has been removed.
 * Accepting tokens from the Authorization header opens a CSRF vector: a
 * malicious page could trick a user into making a cross-origin request that
 * includes a token the attacker obtained (e.g. via XSS on a different origin).
 * httpOnly cookies are not accessible to JavaScript and are scoped to the same
 * origin, so they provide a stronger security boundary.
 *
 * Attaches decoded payload to req.auth.
 * Returns 401 if the cookie is missing or the token is invalid/expired.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const raw: string | undefined = req.cookies?.[OTP_CONFIG.ACCESS_COOKIE_NAME];

  if (!raw) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const decoded = verifyAccessToken(raw) as AccessTokenPayload;
    req.auth = { userId: decoded.userId, phone: decoded.phone, businessId: decoded.businessId };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

/**
 * Verifies the authenticated user owns the requested businessId.
 * Must be used AFTER requireAuth.
 * Reads businessId from req.query, req.body, or req.params — then
 * cross-checks against req.auth.businessId to prevent IDOR.
 */
export function requireBusinessOwnership(req: Request, res: Response, next: NextFunction): void {
  const rawId = req.query.businessId ?? req.body?.businessId ?? req.params?.businessId;
  const requestedId = rawId !== undefined ? parseInt(String(rawId), 10) : NaN;

  if (isNaN(requestedId)) {
    res.status(400).json({ error: "businessId is required." });
    return;
  }

  if (req.auth?.businessId !== requestedId) {
    res.status(403).json({ error: "Access denied. You do not own this business." });
    return;
  }

  next();
}
