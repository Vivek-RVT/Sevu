import { z } from "zod";

/** Positive integer from a route param (string → number). */
export const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "ID must be a positive integer")
    .transform(Number)
    .refine((n) => n > 0 && Number.isInteger(n), "ID must be a positive integer"),
});
export type IdParam = z.infer<typeof idParamSchema>;

/** URL slug param — alphanumeric + hyphens, 1–120 chars. */
export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120, "Slug too long")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, digits, and hyphens"),
});
export type SlugParam = z.infer<typeof slugParamSchema>;

/**
 * Indian mobile number validator.
 * Accepts: +91XXXXXXXXXX | 91XXXXXXXXXX | 10-digit mobile.
 * Normalises to the raw 10-digit mobile string.
 */
export const indianPhoneSchema = z
  .string()
  .trim()
  .min(10, "Phone number is required")
  .max(15, "Phone number too long")
  .transform((v) => v.replace(/\D/g, ""))
  .refine((digits) => {
    const mobile =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 10
          ? digits
          : null;
    return mobile !== null && /^[6-9]\d{9}$/.test(mobile);
  }, "Enter a valid 10-digit Indian mobile number starting with 6–9")
  .transform((digits) =>
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits,
  );
