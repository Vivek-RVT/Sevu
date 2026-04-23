import app from "./app";
import { logger } from "./lib/logger";
import { OTP_CONFIG } from "./config/otp.js";

// ── Startup Security Checks ──────────────────────────────────────────────────

const DEFAULT_JWT_SECRET = "sevu-dev-secret-change-in-production";
if (OTP_CONFIG.JWT_SECRET === DEFAULT_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    logger.error("FATAL: JWT_SECRET is set to the insecure default value in production. Refusing to start.");
    process.exit(1);
  } else {
    logger.warn("WARNING: JWT_SECRET is using the insecure default. Set JWT_SECRET env var before deploying.");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
