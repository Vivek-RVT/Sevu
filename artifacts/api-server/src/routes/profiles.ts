import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { profilesTable, profileReviewsTable } from "@workspace/db/schema";
import { eq, ilike, desc, and, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CreateProfileBody, type CreateProfileBodyType,
  UpdateProfileBody, type UpdateProfileBodyType,
  AddProfileReviewBody, type AddProfileReviewBodyType,
  ProfileListQuery, type ProfileListQueryType,
  ProfileTrackBody, type ProfileTrackBodyType,
  ProfileSlugParam, type ProfileSlugParamType,
} from "../validators/profile.schema.js";
import { cacheGet, cacheSet, cacheDel, CacheTTL } from "../lib/cache.js";

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many reviews submitted. Please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many tracking requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router: IRouter = Router();

function generateSlug(name: string, service: string, city: string): string {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const nameSlug = norm(name);
  const serviceSlug = norm(service);
  const citySlug = norm(city);

  // Skip the service segment entirely if it's already inside the name
  // (avoids "vivek-ac-repair" + "ac-repair" → "vivek-ac-repair-ac-repair")
  const parts = [nameSlug];
  if (serviceSlug && !nameSlug.includes(serviceSlug)) parts.push(serviceSlug);
  if (citySlug && !nameSlug.includes(citySlug)) parts.push(citySlug);

  // Final pass: collapse any remaining repeated adjacent tokens
  const tokens = parts.join("-").split("-").filter(Boolean);
  const dedup: string[] = [];
  for (const t of tokens) {
    if (dedup[dedup.length - 1] !== t) dedup.push(t);
  }
  return dedup.join("-");
}

function formatProfile(p: typeof profilesTable.$inferSelect) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

// GET /profiles — list profiles with optional filters
router.get(
  "/",
  validate({ query: ProfileListQuery }),
  async (req, res) => {
    const { service, city, limit, businessId } = req.validated.query as ProfileListQueryType;

    const conditions = [];
    if (service) conditions.push(ilike(profilesTable.service, `%${service}%`));
    if (city) conditions.push(ilike(profilesTable.city, `%${city}%`));
    if (businessId) conditions.push(eq(profilesTable.businessId, businessId));

    const profiles = await db
      .select()
      .from(profilesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(profilesTable.rating))
      .limit(limit ?? 20);

    res.json(profiles.map(formatProfile));
  },
);

// POST /profiles — create a new profile (requires auth; businessId taken from token)
router.post(
  "/",
  requireAuth,
  validate({ body: CreateProfileBody }),
  async (req, res) => {
    const data = req.validated.body as CreateProfileBodyType;
    const businessId = req.auth!.businessId;

    if (!businessId) {
      res.status(403).json({ error: "You must have a business linked to create a profile." });
      return;
    }

    const slug = generateSlug(data.name, data.service, data.city);

    const existing = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.slug, slug));
    const finalSlug = existing.length > 0 ? `${slug}-${Date.now()}` : slug;

    const [profile] = await db
      .insert(profilesTable)
      .values({ ...data, businessId, slug: finalSlug })
      .returning();

    res.status(201).json(formatProfile(profile));
  },
);

// GET /profiles/:slug — get profile + reviews (cached)
router.get(
  "/:slug",
  validate({ params: ProfileSlugParam }),
  async (req, res) => {
    const { slug } = req.validated.params as ProfileSlugParamType;

    const cacheKey = `profile:${slug}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.slug, slug));

    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const reviews = await db
      .select()
      .from(profileReviewsTable)
      .where(eq(profileReviewsTable.profileId, profile.id))
      .orderBy(desc(profileReviewsTable.createdAt))
      .limit(50);

    const payload = {
      ...formatProfile(profile),
      reviews: reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };

    await cacheSet(cacheKey, payload, CacheTTL.PROFILE);
    res.json(payload);
  },
);

// PUT /profiles/:slug — update a profile (requires auth + business ownership)
router.put(
  "/:slug",
  requireAuth,
  validate({ params: ProfileSlugParam, body: UpdateProfileBody }),
  async (req, res) => {
    const { slug } = req.validated.params as ProfileSlugParamType;
    const data = req.validated.body as UpdateProfileBodyType;
    const businessId = req.auth!.businessId;

    const [existing] = await db
      .select({ id: profilesTable.id, businessId: profilesTable.businessId })
      .from(profilesTable)
      .where(eq(profilesTable.slug, slug));

    if (!existing) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }

    if (existing.businessId !== businessId) {
      res.status(403).json({ error: "Access denied. You do not own this profile." });
      return;
    }

    const [profile] = await db
      .update(profilesTable)
      .set(data)
      .where(eq(profilesTable.id, existing.id))
      .returning();

    await cacheDel(`profile:${slug}`);
    res.json(formatProfile(profile));
  },
);

// POST /profiles/:slug/track — SQL increment, no read-before-write
router.post(
  "/:slug/track",
  trackLimiter,
  validate({ params: ProfileSlugParam, body: ProfileTrackBody }),
  async (req, res) => {
    const { slug } = req.validated.params as ProfileSlugParamType;
    const { type } = req.validated.body as ProfileTrackBodyType;

    const updateObj =
      type === "view"  ? { viewCount:      sql`view_count + 1` }      :
      type === "call"  ? { callClicks:     sql`call_clicks + 1` }     :
                         { whatsappClicks: sql`whatsapp_clicks + 1` } ;

    const result = await db
      .update(profilesTable)
      .set(updateObj)
      .where(eq(profilesTable.slug, slug))
      .returning({ id: profilesTable.id });

    if (!result.length) { res.status(404).json({ error: "Profile not found" }); return; }

    res.json({ success: true });
  },
);

// GET /profiles/:slug/analytics — profile analytics (requires ownership)
router.get(
  "/:slug/analytics",
  requireAuth,
  validate({ params: ProfileSlugParam }),
  async (req, res) => {
    const { slug } = req.validated.params as ProfileSlugParamType;

    const [profile] = await db
      .select({
        id: profilesTable.id,
        businessId: profilesTable.businessId,
        name: profilesTable.name,
        service: profilesTable.service,
        city: profilesTable.city,
        rating: profilesTable.rating,
        totalReviews: profilesTable.totalReviews,
        totalJobs: profilesTable.totalJobs,
        viewCount: profilesTable.viewCount,
        callClicks: profilesTable.callClicks,
        whatsappClicks: profilesTable.whatsappClicks,
        slug: profilesTable.slug,
      })
      .from(profilesTable)
      .where(eq(profilesTable.slug, slug));

    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    if (profile.businessId !== req.auth!.businessId) {
      res.status(403).json({ error: "Access denied. You do not own this profile." });
      return;
    }

    const reviews = await db
      .select()
      .from(profileReviewsTable)
      .where(eq(profileReviewsTable.profileId, profile.id))
      .orderBy(desc(profileReviewsTable.createdAt))
      .limit(10);

    res.json({
      ...profile,
      reviews: reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  },
);

// POST /profiles/:slug/reviews — add a review, recalculate avg via SQL
router.post(
  "/:slug/reviews",
  reviewLimiter,
  validate({ params: ProfileSlugParam, body: AddProfileReviewBody }),
  async (req, res) => {
    const { slug } = req.validated.params as ProfileSlugParamType;
    const data = req.validated.body as AddProfileReviewBodyType;

    const [profile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.slug, slug));

    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const [review] = await db
      .insert(profileReviewsTable)
      .values({ profileId: profile.id, ...data })
      .returning();

    // Recalculate avg rating and total using SQL — no need to fetch all reviews
    const [stats] = await db
      .select({
        avg: sql<number>`AVG(${profileReviewsTable.rating})`,
        total: count(),
      })
      .from(profileReviewsTable)
      .where(eq(profileReviewsTable.profileId, profile.id));

    await db
      .update(profilesTable)
      .set({ rating: Number(stats?.avg ?? 0), totalReviews: stats?.total ?? 1 })
      .where(eq(profilesTable.id, profile.id));

    await cacheDel(`profile:${slug}`);
    res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
  },
);

export default router;
