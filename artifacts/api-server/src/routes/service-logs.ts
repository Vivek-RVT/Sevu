import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  serviceLogsTable,
  customersTable,
  profilesTable,
  businessesTable,
} from "@workspace/db/schema";
import { eq, desc, and, ilike, sql, gte, lt, count } from "drizzle-orm";
import { requireBusinessOwnership } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getPlanLimits } from "../lib/plans.js";
import { cacheDel } from "../lib/cache.js";
import {
  CreateServiceLogBody, type CreateServiceLogBodyType,
  UpdateServiceLogBody, type UpdateServiceLogBodyType,
  ServiceLogListQuery, type ServiceLogListQueryType,
  ServiceLogIdParam, type ServiceLogIdParamType,
} from "../validators/service-log.schema.js";

const router: IRouter = Router();

const UNDO_WINDOW_MS = 10 * 60 * 1000;
const MIN_AGE_MS = 30 * 60 * 1000;

function formatLog(log: typeof serviceLogsTable.$inferSelect) {
  return {
    ...log,
    serviceDate: log.serviceDate.toISOString(),
    paymentDate: log.paymentDate ? log.paymentDate.toISOString() : null,
    nextVisit: log.nextVisit ? log.nextVisit.toISOString() : null,
    completedAt: log.completedAt ? log.completedAt.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
  };
}

/** Get start-of-day and start-of-tomorrow for "today" boundary checks. */
function todayBoundary(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Adjust profile.totalJobs (per-business profile, if any) by delta and bust cache. */
async function adjustProfileJobsCount(
  businessId: number,
  delta: number,
): Promise<number | null> {
  const updated = await db
    .update(profilesTable)
    .set({ totalJobs: sql`GREATEST(0, ${profilesTable.totalJobs} + ${delta})` })
    .where(eq(profilesTable.businessId, businessId))
    .returning({ totalJobs: profilesTable.totalJobs, slug: profilesTable.slug });
  for (const p of updated) {
    await cacheDel(`profile:${p.slug}`);
  }
  return updated[0]?.totalJobs ?? null;
}

/** Return a log only if it belongs to the authenticated business. */
async function verifyLogOwnership(
  logId: number,
  businessId: number,
): Promise<typeof serviceLogsTable.$inferSelect | null> {
  const [log] = await db
    .select()
    .from(serviceLogsTable)
    .where(and(eq(serviceLogsTable.id, logId), eq(serviceLogsTable.businessId, businessId)));
  return log ?? null;
}

/** Recalculate customer totals using SQL aggregates — no JS loop over all logs. */
async function recalcCustomerTotals(customerId: number): Promise<void> {
  const [totals] = await db
    .select({
      totalSpent: sql<number>`COALESCE(SUM(CASE
        WHEN payment_status = 'paid'    THEN COALESCE(amount, 0)
        WHEN payment_status = 'partial' THEN COALESCE(paid_amount, 0)
        ELSE 0 END), 0)`,
      outstandingBalance: sql<number>`COALESCE(SUM(CASE
        WHEN payment_status = 'pending' THEN COALESCE(amount, 0)
        WHEN payment_status = 'partial' THEN COALESCE(amount, 0) - COALESCE(paid_amount, 0)
        ELSE 0 END), 0)`,
    })
    .from(serviceLogsTable)
    .where(eq(serviceLogsTable.customerId, customerId));

  await db
    .update(customersTable)
    .set({
      totalSpent: Number(totals?.totalSpent ?? 0),
      outstandingBalance: Number(totals?.outstandingBalance ?? 0),
    })
    .where(eq(customersTable.id, customerId));
}

// GET /service-logs — list logs for the authenticated business
router.get(
  "/",
  requireBusinessOwnership,
  validate({ query: ServiceLogListQuery }),
  async (req, res) => {
    const { businessId, customerId } = req.validated.query as ServiceLogListQueryType;

    const conditions = customerId
      ? and(eq(serviceLogsTable.businessId, businessId), eq(serviceLogsTable.customerId, customerId))
      : eq(serviceLogsTable.businessId, businessId);

    const logs = await db
      .select()
      .from(serviceLogsTable)
      .where(conditions)
      .orderBy(desc(serviceLogsTable.serviceDate))
      .limit(200);

    res.json(logs.map(formatLog));
  },
);

// POST /service-logs — create a log for the authenticated business
router.post(
  "/",
  requireBusinessOwnership,
  validate({ body: CreateServiceLogBody }),
  async (req, res) => {
    const data = req.validated.body as CreateServiceLogBodyType;

    let customerId = data.customerId;
    if (!customerId && data.customerName?.trim()) {
      const name = data.customerName.trim();
      const [existing] = await db
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(and(eq(customersTable.businessId, data.businessId), ilike(customersTable.name, name)));

      if (existing) {
        customerId = existing.id;
      } else {
        const totalSpent = data.paymentStatus === "paid"
          ? (data.amount ?? 0)
          : data.paymentStatus === "partial"
            ? (data.paidAmount ?? 0)
            : 0;
        const outstandingBalance = data.paymentStatus === "pending"
          ? (data.amount ?? 0)
          : data.paymentStatus === "partial"
            ? (data.amount ?? 0) - (data.paidAmount ?? 0)
            : 0;

        const [created] = await db
          .insert(customersTable)
          .values({
            businessId: data.businessId,
            name,
            phone: "",
            serviceType: data.service || "",
            lastServiceDate: new Date(data.serviceDate).toISOString().split("T")[0],
            totalSpent,
            outstandingBalance,
          })
          .returning();
        customerId = created.id;
      }
    }

    const [log] = await db
      .insert(serviceLogsTable)
      .values({
        ...data,
        customerId,
        serviceDate: new Date(data.serviceDate),
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
        nextVisit: data.nextVisit ? new Date(data.nextVisit) : undefined,
      })
      .returning();

    res.status(201).json(formatLog(log));
  },
);

// PUT /service-logs/:id — update a log
router.put(
  "/:id",
  validate({ params: ServiceLogIdParam, body: UpdateServiceLogBody }),
  async (req, res) => {
    const { id } = req.validated.params as ServiceLogIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) { res.status(403).json({ error: "No business associated with your account." }); return; }

    const existing = await verifyLogOwnership(id, businessId);
    if (!existing) { res.status(404).json({ error: "Service log not found" }); return; }

    const data = req.validated.body as UpdateServiceLogBodyType;
    const [log] = await db
      .update(serviceLogsTable)
      .set({
        ...data,
        serviceDate: data.serviceDate ? new Date(data.serviceDate) : undefined,
        paymentDate: data.paymentDate === null ? null : data.paymentDate ? new Date(data.paymentDate) : undefined,
        nextVisit: data.nextVisit === null ? null : data.nextVisit ? new Date(data.nextVisit) : undefined,
      })
      .where(eq(serviceLogsTable.id, id))
      .returning();

    if (!log) {
      res.status(404).json({ error: "Service log not found" });
      return;
    }

    if (log.customerId) {
      await recalcCustomerTotals(log.customerId);
    }

    res.json(formatLog(log));
  },
);

// DELETE /service-logs/:id — delete a log
router.delete(
  "/:id",
  validate({ params: ServiceLogIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as ServiceLogIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) { res.status(403).json({ error: "No business associated with your account." }); return; }

    const existing = await verifyLogOwnership(id, businessId);
    if (!existing) { res.status(404).json({ error: "Service log not found" }); return; }

    await db.delete(serviceLogsTable).where(eq(serviceLogsTable.id, id));

    if (existing.customerId) {
      await recalcCustomerTotals(existing.customerId);
    }

    // If the deleted log was completed, decrement the public profile's jobs count
    if (existing.completionStatus === "completed") {
      await adjustProfileJobsCount(businessId, -1);
    }

    res.status(204).send();
  },
);

/* ── PATCH /service-logs/:id/complete ────────────────────────────────────────
 * Marks a service log as completed. Enforces three anti-spam rules:
 *   1. Duplicate block — same customer can't be completed twice on the same day.
 *   2. Minimum age   — service must be at least 30 minutes old.
 *   3. Daily plan cap — completions per day capped by current plan.
 * On success, increments the public profile's totalJobs counter.
 */
router.patch(
  "/:id/complete",
  validate({ params: ServiceLogIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as ServiceLogIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) {
      res.status(403).json({ error: "No business associated with your account." });
      return;
    }

    const existing = await verifyLogOwnership(id, businessId);
    if (!existing) {
      res.status(404).json({ error: "Service log not found" });
      return;
    }
    if (existing.completionStatus === "completed") {
      res.status(400).json({
        error: "ALREADY_COMPLETED",
        message: "Yeh job pehle se complete mark hai.",
      });
      return;
    }

    // Rule 2: Minimum 30-min age since creation.
    const ageMs = Date.now() - existing.createdAt.getTime();
    if (ageMs < MIN_AGE_MS) {
      const remainingMin = Math.max(1, Math.ceil((MIN_AGE_MS - ageMs) / 60_000));
      res.status(400).json({
        error: "TOO_EARLY",
        message: `Job abhi add ki hai, ${remainingMin} minute baad complete karen.`,
        retryAfterMs: MIN_AGE_MS - ageMs,
      });
      return;
    }

    const { start: dayStart, end: dayEnd } = todayBoundary();

    // Rule 1: No other completion for the same customer today.
    if (existing.customerId) {
      const [dup] = await db
        .select({ id: serviceLogsTable.id })
        .from(serviceLogsTable)
        .where(
          and(
            eq(serviceLogsTable.businessId, businessId),
            eq(serviceLogsTable.customerId, existing.customerId),
            eq(serviceLogsTable.completionStatus, "completed"),
            gte(serviceLogsTable.completedAt, dayStart),
            lt(serviceLogsTable.completedAt, dayEnd),
          ),
        )
        .limit(1);
      if (dup) {
        res.status(400).json({
          error: "DUPLICATE_TODAY",
          message: "Aaj is customer ka kaam pehle se complete mark hua hai.",
        });
        return;
      }
    }

    // Rule 3: Daily cap by plan.
    const [biz] = await db
      .select({ plan: businessesTable.plan })
      .from(businessesTable)
      .where(eq(businessesTable.id, businessId));
    const limits = getPlanLimits(biz?.plan);

    const [{ value: dailyCount }] = await db
      .select({ value: count() })
      .from(serviceLogsTable)
      .where(
        and(
          eq(serviceLogsTable.businessId, businessId),
          eq(serviceLogsTable.completionStatus, "completed"),
          gte(serviceLogsTable.completedAt, dayStart),
          lt(serviceLogsTable.completedAt, dayEnd),
        ),
      );
    if (dailyCount >= limits.maxCompletionsPerDay) {
      res.status(403).json({
        error: "DAILY_CAP_REACHED",
        message: `Aaj ki limit poori ho gayi hai (${limits.maxCompletionsPerDay} completions/day).`,
        plan: biz?.plan ?? "starter",
        cap: limits.maxCompletionsPerDay,
        used: dailyCount,
      });
      return;
    }

    // All checks passed — mark complete.
    const [updated] = await db
      .update(serviceLogsTable)
      .set({ completionStatus: "completed", completedAt: new Date() })
      .where(eq(serviceLogsTable.id, id))
      .returning();

    const totalJobs = await adjustProfileJobsCount(businessId, +1);

    res.json({
      log: formatLog(updated),
      totalJobs,
      undoExpiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
      serverTime: new Date().toISOString(),
    });
  },
);

/* ── PATCH /service-logs/:id/undo-complete ───────────────────────────────────
 * Reverts a completion within a 10-minute window after it was marked.
 */
router.patch(
  "/:id/undo-complete",
  validate({ params: ServiceLogIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as ServiceLogIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) {
      res.status(403).json({ error: "No business associated with your account." });
      return;
    }

    const existing = await verifyLogOwnership(id, businessId);
    if (!existing) {
      res.status(404).json({ error: "Service log not found" });
      return;
    }
    if (existing.completionStatus !== "completed" || !existing.completedAt) {
      res.status(400).json({ error: "Service is not marked complete." });
      return;
    }

    const elapsedMs = Date.now() - existing.completedAt.getTime();
    if (elapsedMs > UNDO_WINDOW_MS) {
      res.status(400).json({
        error: "UNDO_EXPIRED",
        message: "Undo ka 10-minute window khatam ho gaya hai.",
      });
      return;
    }

    const [updated] = await db
      .update(serviceLogsTable)
      .set({ completionStatus: "pending", completedAt: null })
      .where(eq(serviceLogsTable.id, id))
      .returning();

    const totalJobs = await adjustProfileJobsCount(businessId, -1);

    res.json({
      log: formatLog(updated),
      totalJobs,
      serverTime: new Date().toISOString(),
    });
  },
);

/* ── GET /service-logs/jobs-count ────────────────────────────────────────────
 * Returns total completions, today's completions, and the daily plan cap
 * for the authenticated business — used for dashboard badges & quotas.
 */
router.get("/jobs-count", async (req, res) => {
  const businessId = req.auth?.businessId;
  if (!businessId) {
    res.status(403).json({ error: "No business associated with your account." });
    return;
  }

  const { start: dayStart, end: dayEnd } = todayBoundary();

  const [biz] = await db
    .select({ plan: businessesTable.plan })
    .from(businessesTable)
    .where(eq(businessesTable.id, businessId));
  const limits = getPlanLimits(biz?.plan);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(serviceLogsTable)
    .where(
      and(
        eq(serviceLogsTable.businessId, businessId),
        eq(serviceLogsTable.completionStatus, "completed"),
      ),
    );

  const [{ value: today }] = await db
    .select({ value: count() })
    .from(serviceLogsTable)
    .where(
      and(
        eq(serviceLogsTable.businessId, businessId),
        eq(serviceLogsTable.completionStatus, "completed"),
        gte(serviceLogsTable.completedAt, dayStart),
        lt(serviceLogsTable.completedAt, dayEnd),
      ),
    );

  res.json({
    total,
    today,
    plan: biz?.plan ?? "starter",
    dailyCap: limits.maxCompletionsPerDay,
    remaining: Math.max(0, limits.maxCompletionsPerDay - today),
  });
});

export default router;
