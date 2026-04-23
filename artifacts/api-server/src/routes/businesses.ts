import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CreateBusinessBody, type CreateBusinessBodyType,
  UpdateBusinessBody, type UpdateBusinessBodyType,
  BusinessLoginQuery, type BusinessLoginQueryType,
  BusinessIdParam, type BusinessIdParamType,
} from "../validators/business.schema.js";
import { cacheGet, cacheSet, cacheDel, CacheTTL } from "../lib/cache.js";

const router: IRouter = Router();

// GET /businesses/login
router.get(
  "/login",
  validate({ query: BusinessLoginQuery }),
  async (req, res) => {
    const { phone } = req.validated.query as BusinessLoginQueryType;
    const businesses = await db
      .select({ id: businessesTable.id, name: businessesTable.name, category: businessesTable.category })
      .from(businessesTable)
      .where(eq(businessesTable.phone, phone));
    if (businesses.length === 0) {
      res.status(404).json({ error: "No business found with this phone number" });
      return;
    }
    res.json(businesses[0]);
  },
);

// GET /businesses/:id — read own business only (with cache)
router.get(
  "/:id",
  validate({ params: BusinessIdParam }),
  async (req, res) => {
    const { id } = req.validated.params as BusinessIdParamType;

    if (req.auth?.businessId !== id) {
      res.status(403).json({ error: "Access denied. You do not own this business." });
      return;
    }

    const cacheKey = `business:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.id, id));
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const payload = { ...business, createdAt: business.createdAt.toISOString() };
    await cacheSet(cacheKey, payload, CacheTTL.BUSINESS);
    res.json(payload);
  },
);

// POST /businesses — create a new business (one per account)
router.post(
  "/",
  validate({ body: CreateBusinessBody }),
  async (req, res) => {
    const userId = req.auth?.userId;
    if (userId) {
      const [existingUser] = await db
        .select({ businessId: usersTable.businessId })
        .from(usersTable)
        .where(eq(usersTable.id, userId));

      if (existingUser?.businessId) {
        res.status(409).json({
          error: "Your account is already linked to a business. Each account may only have one business.",
        });
        return;
      }
    }

    const data = req.validated.body as CreateBusinessBodyType;
    const [business] = await db.insert(businessesTable).values(data).returning();
    res.status(201).json({ ...business, createdAt: business.createdAt.toISOString() });
  },
);

// PUT /businesses/:id — update own business only
router.put(
  "/:id",
  validate({ params: BusinessIdParam, body: UpdateBusinessBody }),
  async (req, res) => {
    const { id } = req.validated.params as BusinessIdParamType;

    if (req.auth?.businessId !== id) {
      res.status(403).json({ error: "Access denied. You do not own this business." });
      return;
    }

    const data = req.validated.body as UpdateBusinessBodyType;
    const [business] = await db
      .update(businessesTable)
      .set(data)
      .where(eq(businessesTable.id, id))
      .returning();
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    await cacheDel(`business:${id}`);
    res.json({ ...business, createdAt: business.createdAt.toISOString() });
  },
);

export default router;
