import { z } from "zod";
import {
  CreateProfileBody,
  UpdateProfileBody as GeneratedUpdateProfileBody,
  ListProfilesQueryParams,
  AddProfileReviewBody,
} from "@workspace/api-zod";
import { slugParamSchema } from "./common.schema.js";

/**
 * Extends the generated UpdateProfileBody with `shopImage` (banner image),
 * which exists in the DB schema but is missing from the OpenAPI spec.
 * Without this, banner uploads silently fail with "No values to set".
 */
export const UpdateProfileBody = GeneratedUpdateProfileBody.extend({
  shopImage: z.string().optional(),
}).strict();

export {
  CreateProfileBody,
  AddProfileReviewBody,
};
export { slugParamSchema as ProfileSlugParam };

/** Extends the generated list schema to include optional businessId filter. */
export const ProfileListQuery = ListProfilesQueryParams.extend({
  businessId: z
    .string()
    .regex(/^\d+$/, "businessId must be a positive integer")
    .transform(Number)
    .optional(),
});
export type ProfileListQueryType = z.infer<typeof ProfileListQuery>;

/** POST /:slug/track body — which interaction type to record. */
export const ProfileTrackBody = z
  .object({
    type: z.enum(["view", "call", "whatsapp"], {
      errorMap: () => ({ message: "type must be one of: view, call, whatsapp" }),
    }),
  })
  .strict();
export type ProfileTrackBodyType = z.infer<typeof ProfileTrackBody>;

export type CreateProfileBodyType = z.infer<typeof CreateProfileBody>;
export type UpdateProfileBodyType = z.infer<typeof UpdateProfileBody>;
export type AddProfileReviewBodyType = z.infer<typeof AddProfileReviewBody>;
export type ProfileSlugParamType = z.infer<typeof slugParamSchema>;
