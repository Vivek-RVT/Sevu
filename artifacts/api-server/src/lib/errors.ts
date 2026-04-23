/**
 * SafeClientError — an error whose message is safe to return directly to clients.
 *
 * The global error handler uses this class to decide whether to forward
 * the error message or replace it with a generic fallback.
 *
 * Usage:
 *   throw new SafeClientError("Invalid input.", 400);
 *
 * Replaces the fragile `err.message.includes("query")` substring check.
 */
export class SafeClientError extends Error {
  public readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SafeClientError";
    this.status = status;
    Object.setPrototypeOf(this, SafeClientError.prototype);
  }
}
