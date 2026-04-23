import { type Request, type Response, type NextFunction } from "express";

// Keys that must never appear in any client-supplied JSON — they are the
// standard vectors for prototype-pollution attacks.
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Recursively sanitize string values in an object.
 *
 * Protections applied:
 *   - Null bytes stripped (guard against binary injection)
 *   - Common HTML/XSS patterns removed (<script>, javascript:, on*=)
 *   - Prototype-pollution keys (__proto__, constructor, prototype) silently
 *     dropped — keeping them would allow JSON.parse payloads to poison
 *     Object.prototype and affect every object in the process
 */
function sanitizeValue(value: unknown, depth = 0): unknown {
  // Limit recursion depth to prevent a deeply nested payload from causing a
  // stack overflow (cheap DoS on the sanitizer itself).
  if (depth > 20) return null;

  if (typeof value === "string") {
    return value
      .replace(/\0/g, "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/on\w+\s*=/gi, "");
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Drop prototype-pollution keys entirely
      if (BLOCKED_KEYS.has(key)) continue;
      cleaned[key] = sanitizeValue(val, depth + 1);
    }
    return cleaned;
  }
  return value;
}

/** Sanitize req.body and req.query string fields on every request. */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body) as Record<string, unknown>;
  }
  // req.query is a read-only getter — mutate the parsed object in-place instead
  if (req.query && typeof req.query === "object") {
    const cleaned = sanitizeValue(req.query) as Record<string, unknown>;
    for (const key of Object.keys(cleaned)) {
      (req.query as Record<string, unknown>)[key] = cleaned[key];
    }
  }
  next();
}
