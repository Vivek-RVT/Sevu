import { z } from "zod";
import { CreateBusinessBody, UpdateBusinessBody } from "@workspace/api-zod";
import { idParamSchema } from "./common.schema.js";

export { CreateBusinessBody, UpdateBusinessBody };
export { idParamSchema as BusinessIdParam };

/**
 * Query params for GET /businesses/login — look up a business by phone.
 * Validates format but does NOT normalise — we match what was stored at creation.
 */
export const BusinessLoginQuery = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Phone is required")
    .max(15, "Phone too long")
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      const mobile =
        digits.length === 12 && digits.startsWith("91")
          ? digits.slice(2)
          : digits.length === 10
            ? digits
            : null;
      return mobile !== null && /^[6-9]\d{9}$/.test(mobile);
    }, "Enter a valid Indian mobile number"),
});
export type BusinessLoginQueryType = z.infer<typeof BusinessLoginQuery>;

export type CreateBusinessBodyType = z.infer<typeof CreateBusinessBody>;
export type UpdateBusinessBodyType = z.infer<typeof UpdateBusinessBody>;
export type BusinessIdParamType = z.infer<typeof idParamSchema>;
