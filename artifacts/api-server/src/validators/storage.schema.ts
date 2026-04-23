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
