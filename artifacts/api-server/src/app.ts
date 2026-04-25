import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { redis } from "./lib/redis.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import { checkIpBan } from "./middleware/ipBan.js";
import { SafeClientError } from "./lib/errors.js";

const app: Express = express();

// Trust the reverse proxy (Replit / load balancer) so rate-limit can read the
// real client IP from X-Forwarded-For instead of raising a validation error.
app.set("trust proxy", 1);

// ── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' removed — use external stylesheets only.
        // The API server does not serve HTML with inline styles; all styling
        // lives in the separately-served frontend bundle.
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.msg91.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: "deny" },
  }),
);

// ── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  /^https?:\/\/[^/]+\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.replit\.app(:\d+)?$/,
  /^https?:\/\/[^/]+\.pike\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.kirk\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.spock\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.picard\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.janeway\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.sisko\.replit\.dev(:\d+)?$/,
  /^https?:\/\/[^/]+\.worf\.replit\.dev(:\d+)?$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

if (process.env.ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(process.env.ALLOWED_ORIGIN);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        if (process.env.NODE_ENV !== "production") return callback(null, true);
        const err = new Error("Not allowed by CORS") as Error & { status: number };
        err.status = 403;
        return callback(err);
      }
      const allowed = ALLOWED_ORIGINS.some((rule) =>
        typeof rule === "string" ? rule === origin : rule.test(origin),
      );
      if (allowed) return callback(null, true);
      const err = new Error("Not allowed by CORS") as Error & { status: number };
      err.status = 403;
      callback(err);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ── Gzip Compression ─────────────────────────────────────────────────────────
app.use(compression());

// ── Cookie Parser ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Global Rate Limiter ──────────────────────────────────────────────────────
// Uses Redis-backed store when available so limits persist across restarts
// and are enforced consistently in multi-instance deployments.
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  ...(redis
    ? {
        store: new RedisStore({
          sendCommand: (...args: string[]) => (redis as any).call(...args),
          prefix: "rl:global:",
        }),
      }
    : {}),
});

app.use(globalLimiter);

// ── IP Ban Check ─────────────────────────────────────────────────────────────
app.use(checkIpBan);

// ── Request Logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Body Parsing (with size limit) ──────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Input Sanitization ───────────────────────────────────────────────────────
app.use(sanitizeInput);

// ── Request Timeout (30 seconds) ────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(30_000, () => {
    res.status(408).json({ error: "Request timed out." });
  });
  next();
});

/* ── TWA / Play Store: Digital Asset Links ────────────────────────────────── */
app.get("/.well-known/assetlinks.json", (_req, res) => {
  const sha256 = process.env.TWA_SHA256_FINGERPRINT ?? "REPLACE_WITH_YOUR_SHA256_FINGERPRINT";
  const packageName = process.env.TWA_PACKAGE_NAME ?? "com.sevu.app";
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [sha256],
      },
    },
  ]);
});

app.use("/api", router);

// ── Global Error Handler ─────────────────────────────────────────────────────
// SafeClientError messages are safe to return directly to clients.
// All other errors are logged server-side and replaced with a generic message.
// This prevents SQL query/schema leakage and internal stack trace disclosure.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as any).status ?? 500;

  // CORS rejections: surface as 403 with a clean message
  if (status === 403 && err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Forbidden." });
    return;
  }

  // SafeClientError: message is explicitly marked safe for the client
  if (err instanceof SafeClientError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Log full error detail server-side only
  logger.error({ err: { message: err.message, name: err.name, stack: err.stack } }, "Unhandled error");

  // Never return raw error messages for server errors — always generic fallback
  const safeMessage = status < 500 ? err.message : "An unexpected error occurred.";
  res.status(status).json({ error: safeMessage });
});

export default app;
