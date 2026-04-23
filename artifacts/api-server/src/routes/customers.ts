import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { requireBusinessOwnership } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CreateCustomerBody, type CreateCustomerBodyType,
  UpdateCustomerBody, type UpdateCustomerBodyType,
  ListCustomersQueryParams, type ListCustomersQueryType,
  CustomerIdParam, type CustomerIdParamType,
} from "../validators/customer.schema.js";

const router: IRouter = Router();

function autoNextServiceDate(serviceType: string, lastDate: string): string | null {
  const lower = serviceType.toLowerCase();
  const base = new Date(lastDate);
  let daysToAdd = 30;
  if (lower.includes("haircut") || lower.includes("hair") || lower.includes("salon") || lower.includes("trim")) {
    daysToAdd = 30;
  } else if (lower.includes("gym") || lower.includes("fitness")) {
    daysToAdd = 30;
  } else if (lower.includes("spa") || lower.includes("massage")) {
    daysToAdd = 30;
  } else if (lower.includes("service") || lower.includes("repair") || lower.includes("plumb") || lower.includes("electric")) {
    daysToAdd = 90;
  } else if (lower.includes("dental") || lower.includes("dentist") || lower.includes("doctor") || lower.includes("check")) {
    daysToAdd = 180;
  }
  base.setDate(base.getDate() + daysToAdd);
  return base.toISOString().split("T")[0];
}

/** Ensure the customer record belongs to the authenticated user's business. */
async function verifyCustomerOwnership(
  customerId: number,
  businessId: number,
): Promise<typeof customersTable.$inferSelect | null> {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.businessId, businessId)));
  return customer ?? null;
}

// GET /customers — list customers for the authenticated business
router.get(
  "/",
  requireBusinessOwnership,
  validate({ query: ListCustomersQueryParams }),
  async (req, res) => {
    const { businessId, search } = req.validated.query as ListCustomersQueryType;

    const conditions = [eq(customersTable.businessId, businessId)];
    if (search) {
      conditions.push(ilike(customersTable.name, `%${search}%`));
    }

    const customers = await db
      .select()
      .from(customersTable)
      .where(and(...conditions))
      .orderBy(customersTable.createdAt);

    res.json(customers.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      lastServiceDate: c.lastServiceDate ?? null,
      nextServiceDate: c.nextServiceDate ?? null,
    })));
  },
);

// POST /customers — create a customer for the authenticated business
router.post(
  "/",
  requireBusinessOwnership,
  validate({ body: CreateCustomerBody }),
  async (req, res) => {
    const data = req.validated.body as CreateCustomerBodyType;
    if (!data.nextServiceDate && data.lastServiceDate && data.serviceType) {
      (data as any).nextServiceDate = autoNextServiceDate(data.serviceType, data.lastServiceDate);
    }
    const [customer] = await db.insert(customersTable).values(data).returning();
    res.status(201).json({
      ...customer,
      createdAt: customer.createdAt.toISOString(),
    });
  },
);

// GET /customers/:id — get a single customer
router.get(
  "/:id",
  validate({ params: CustomerIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as CustomerIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) { res.status(403).json({ error: "No business associated with your account." }); return; }

    const customer = await verifyCustomerOwnership(id, businessId);
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json({ ...customer, createdAt: customer.createdAt.toISOString() });
  },
);

// PUT /customers/:id — update a customer
router.put(
  "/:id",
  validate({ params: CustomerIdParam, body: UpdateCustomerBody }),
  async (req, res) => {
    const { id } = req.validated.params as CustomerIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) { res.status(403).json({ error: "No business associated with your account." }); return; }

    const existing = await verifyCustomerOwnership(id, businessId);
    if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

    const data = req.validated.body as UpdateCustomerBodyType;
    const [customer] = await db
      .update(customersTable)
      .set(data)
      .where(eq(customersTable.id, id))
      .returning();
    res.json({ ...customer, createdAt: customer.createdAt.toISOString() });
  },
);

// DELETE /customers/:id — delete a customer
router.delete(
  "/:id",
  validate({ params: CustomerIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as CustomerIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) { res.status(403).json({ error: "No business associated with your account." }); return; }

    const existing = await verifyCustomerOwnership(id, businessId);
    if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.status(204).send();
  },
);

// POST /customers/:id/mark-done — mark service as done for today
router.post(
  "/:id/mark-done",
  validate({ params: CustomerIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as CustomerIdParamType;
    const businessId = req.auth?.businessId;
    if (!businessId) { res.status(403).json({ error: "No business associated with your account." }); return; }

    const existing = await verifyCustomerOwnership(id, businessId);
    if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

    const today = new Date().toISOString().split("T")[0];
    const nextServiceDate = autoNextServiceDate(existing.serviceType, today);

    const [customer] = await db
      .update(customersTable)
      .set({ lastServiceDate: today, nextServiceDate })
      .where(eq(customersTable.id, id))
      .returning();

    res.json({ ...customer, createdAt: customer.createdAt.toISOString() });
  },
);

export default router;
