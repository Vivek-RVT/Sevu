import { z } from "zod";

/** POST /storage/uploads/request-url body. */
export const RequestUploadUrlBody = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "File name is required")
      .max(255, "File name too long")
      .regex(/^[^/\\<>:"|?*\x00-\x1f]+$/, "File name contains invalid characters"),
    size: z
      .number()
      .int("File size must be an integer")
      .positive("File size must be positive")
      .max(50 * 1024 * 1024, "File exceeds 50 MB limit"),
    contentType: z
      .string()
      .trim()
      .min(1, "Content-Type is required")
      .max(100, "Content-Type too long")
      .regex(/^[\w-]+\/[\w.+\-]+$/, "Invalid MIME type"),
  })
  .strict();
export type RequestUploadUrlBodyType = z.infer<typeof RequestUploadUrlBody>;

/** POST /storage/images body. */
export const SaveImageBody = z
  .object({
    objectPath: z.string().min(1, "objectPath is required"),
    type: z.string().max(50).optional(),
    isPublic: z.boolean().optional(),
    sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
  })
  .strict();
export type SaveImageBodyType = z.infer<typeof SaveImageBody>;

/** Per-business hard cap on total stored bytes (logos + banners + post images). */
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
