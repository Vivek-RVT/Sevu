import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import path from "path";
import { db } from "@workspace/db";
import { businessImagesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { validate } from "../middleware/validate.js";
import {
  RequestUploadUrlBody,
  type RequestUploadUrlBodyType,
} from "../validators/storage.schema.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function sanitizeStoragePath(raw: string | string[]): string | null {
  const joined = Array.isArray(raw) ? raw.join("/") : raw;
  let decoded: string;
  try {
    decoded = decodeURIComponent(joined);
  } catch {
    return null;
  }
  const normalised = path.posix.normalize(decoded);
  if (
    normalised.includes("\0") ||
    normalised.startsWith("..") ||
    normalised.includes("/../") ||
    normalised.startsWith("/")
  ) {
    return null;
  }
  return normalised;
}

async function streamObjectToResponse(objectPath: string, res: Response): Promise<void> {
  const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  const response = await objectStorageService.downloadObject(objectFile);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) {
    const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
    nodeStream.pipe(res);
  } else {
    res.end();
  }
}

/**
 * POST /storage/uploads/request-url
 * Returns a presigned upload URL scoped to the authenticated user's business.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  validate({ body: RequestUploadUrlBody }),
  async (req: Request, res: Response) => {
    try {
      const businessId = req.auth?.businessId;
      if (!businessId) {
        res.status(403).json({ error: "A linked business is required to upload files." });
        return;
      }
      const { name, size, contentType } = req.validated.body as RequestUploadUrlBodyType;
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(businessId);
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * POST /storage/images
 * Save a business image record after a successful upload.
 * Marks image as public so it can be served to non-auth visitors on public profiles.
 */
router.post(
  "/storage/images",
  requireAuth,
  async (req: Request, res: Response) => {
    const businessId = req.auth?.businessId;
    if (!businessId) {
      res.status(403).json({ error: "A linked business is required." });
      return;
    }
    const { objectPath, type, isPublic } = req.body;
    if (!objectPath) {
      res.status(400).json({ error: "objectPath is required." });
      return;
    }
    const [image] = await db
      .insert(businessImagesTable)
      .values({ businessId, objectPath, type: type || "general", isPublic: isPublic ?? false })
      .returning();
    res.status(201).json(image);
  },
);

/**
 * GET /storage/images
 * List all images for the authenticated business.
 */
router.get(
  "/storage/images",
  requireAuth,
  async (req: Request, res: Response) => {
    const businessId = req.auth?.businessId;
    if (!businessId) {
      res.status(403).json({ error: "A linked business is required." });
      return;
    }
    const images = await db
      .select()
      .from(businessImagesTable)
      .where(eq(businessImagesTable.businessId, businessId));
    res.json(images);
  },
);

/**
 * DELETE /storage/images/:id
 * Delete a business image record (auth + ownership enforced).
 */
router.delete(
  "/storage/images/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const businessId = req.auth?.businessId;
    if (!businessId) {
      res.status(403).json({ error: "A linked business is required." });
      return;
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid image id." });
      return;
    }
    await db
      .delete(businessImagesTable)
      .where(and(eq(businessImagesTable.id, id), eq(businessImagesTable.businessId, businessId)));
    res.status(204).send();
  },
);

/**
 * GET /storage/public-objects/*
 * Serve public assets — unconditionally public, no auth required.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const filePath = sanitizeStoragePath(req.params.filePath);
    if (!filePath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/profile-objects/*path
 * Serve business images that are marked as public (isPublic=true).
 * No auth required — allows profile images to appear on public profile pages.
 */
router.get("/storage/profile-objects/*path", async (req: Request, res: Response) => {
  try {
    const wildcardPath = sanitizeStoragePath(req.params.path);
    if (!wildcardPath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;

    const [imageRecord] = await db
      .select({ id: businessImagesTable.id, isPublic: businessImagesTable.isPublic })
      .from(businessImagesTable)
      .where(eq(businessImagesTable.objectPath, objectPath));

    if (!imageRecord?.isPublic) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    await streamObjectToResponse(objectPath, res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving profile object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

/**
 * GET /storage/objects/*path
 * Serve private object entities — requires auth and ownership check.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const wildcardPath = sanitizeStoragePath(req.params.path);
    if (!wildcardPath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }

    const businessId = req.auth?.businessId;
    if (!businessId) {
      res.status(403).json({ error: "A linked business is required to access private files." });
      return;
    }

    const expectedPrefix = `businesses/${businessId}/`;
    if (!wildcardPath.startsWith(expectedPrefix)) {
      res.status(403).json({ error: "Access denied. You do not own this file." });
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    await streamObjectToResponse(objectPath, res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
