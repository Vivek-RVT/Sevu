import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, reminderLogsTable, reviewLogsTable } from "@workspace/db/schema";
import { eq, count, and, lt, isNotNull } from "drizzle-orm";
import { GetDashboardQueryParams } from "@workspace/api-zod";
import { requireBusinessOwnership } from "../middleware/auth.js";
import { cacheGet, cacheSet, CacheTTL } from "../lib/cache.js";

const router: IRouter = Router();

router.get("/", requireBusinessOwnership, async (req, res) => {
  const parsed = GetDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { businessId } = parsed.data;

  const cacheKey = `dashboard:${businessId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const [totalResult, pendingResult, todayCustomers, reminderCount, reviewCount] = await Promise.all([
    db.select({ count: count() })
      .from(customersTable)
      .where(eq(customersTable.businessId, businessId)),
    db.select({ count: count() })
      .from(customersTable)
      .where(and(
        eq(customersTable.businessId, businessId),
        isNotNull(customersTable.nextServiceDate),
        lt(customersTable.nextServiceDate, today),
      )),
    db.select()
      .from(customersTable)
      .where(and(
        eq(customersTable.businessId, businessId),
        eq(customersTable.nextServiceDate, today),
      )),
    db.select({ count: count() })
      .from(reminderLogsTable)
      .where(eq(reminderLogsTable.businessId, businessId)),
    db.select({ count: count() })
      .from(reviewLogsTable)
      .where(eq(reviewLogsTable.businessId, businessId)),
  ]);

  const response = {
    totalCustomers: totalResult[0]?.count ?? 0,
    todayReminders: todayCustomers.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
    pendingFollowups: pendingResult[0]?.count ?? 0,
    remindersSent: reminderCount[0]?.count ?? 0,
    reviewsSent: reviewCount[0]?.count ?? 0,
  };

  await cacheSet(cacheKey, response, CacheTTL.DASHBOARD);
  res.json(response);
});

export default router;
