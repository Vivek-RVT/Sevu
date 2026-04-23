import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceLogsTable, customersTable } from "@workspace/db/schema";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import { requireBusinessOwnership } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CreateServiceLogBody, type CreateServiceLogBodyType,
  UpdateServiceLogBody, type UpdateServiceLogBodyType,
  ServiceLogListQuery, type ServiceLogListQueryType,
  ServiceLogIdParam, type ServiceLogIdParamType,
} from "../validators/service-log.schema.js";

const router: IRouter = Router();

function formatLog(log: typeof serviceLogsTable.$inferSelect) {
  return {
    ...log,
    serviceDate: log.serviceDate.toISOString(),
    paymentDate: log.paymentDate ? log.paymentDate.toISOString() : null,
    nextVisit: log.nextVisit ? log.nextVisit.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
  };
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

    res.status(204).send();
  },
);

export default router;
