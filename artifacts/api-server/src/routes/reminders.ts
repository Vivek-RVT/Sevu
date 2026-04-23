import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reminderLogsTable, reviewLogsTable, customersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import {
  LogReminderSentBody, type LogReminderSentBodyType,
  LogReviewSentBody, type LogReviewSentBodyType,
} from "../validators/reminder.schema.js";

const router: IRouter = Router();

/**
 * Verify the authenticated user owns the business AND the customer belongs to that business.
 * Returns the customer row on success, null on failure.
 */
async function verifyOwnership(
  businessId: number,
  customerId: number,
  authBusinessId: number | null | undefined,
): Promise<boolean> {
  if (authBusinessId !== businessId) return false;

  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.businessId, businessId)));

  return !!customer;
}

router.post(
  "/reminders/log",
  validate({ body: LogReminderSentBody }),
  async (req, res) => {
    const { customerId, businessId } = req.validated.body as LogReminderSentBodyType;

    const allowed = await verifyOwnership(businessId, customerId, req.auth?.businessId);
    if (!allowed) {
      res.status(403).json({ error: "Access denied. You do not own this business or customer." });
      return;
    }

    const [log] = await db
      .insert(reminderLogsTable)
      .values({ customerId, businessId })
      .returning();

    await db
      .update(customersTable)
      .set({ remindersSent: sql`${customersTable.remindersSent} + 1` })
      .where(eq(customersTable.id, customerId));

    res.status(201).json({ ...log, sentAt: log.sentAt.toISOString() });
  },
);

router.post(
  "/reviews/log",
  validate({ body: LogReviewSentBody }),
  async (req, res) => {
    const { customerId, businessId } = req.validated.body as LogReviewSentBodyType;

    const allowed = await verifyOwnership(businessId, customerId, req.auth?.businessId);
    if (!allowed) {
      res.status(403).json({ error: "Access denied. You do not own this business or customer." });
      return;
    }

    const [log] = await db
      .insert(reviewLogsTable)
      .values({ customerId, businessId })
      .returning();

    await db
      .update(customersTable)
      .set({ reviewsSent: sql`${customersTable.reviewsSent} + 1` })
      .where(eq(customersTable.id, customerId));

    res.status(201).json({ ...log, sentAt: log.sentAt.toISOString() });
  },
);

export default router;
