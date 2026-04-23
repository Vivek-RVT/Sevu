import { z } from "zod";
import {
  CreateServiceLogBody,
  UpdateServiceLogBody as _UpdateServiceLogBody,
  ListServiceLogsQueryParams,
} from "@workspace/api-zod";
import { idParamSchema } from "./common.schema.js";

export { CreateServiceLogBody };
export { idParamSchema as ServiceLogIdParam };

/**
 * Extends the generated UpdateServiceLogBody to include fields missing from
 * the OpenAPI spec (paidAmount, paymentDate, customerName) and to allow
 * nullable nextVisit / paymentDate so callers can explicitly clear them.
 */
export const UpdateServiceLogBody = _UpdateServiceLogBody.extend({
  paidAmount:    z.number().nullable().optional(),
  paymentDate:   z.string().nullable().optional(),
  nextVisit:     z.string().nullable().optional(),
  customerName:  z.string().optional(),
  customerId:    z.number().nullable().optional(),
});

/** Extends the generated query schema to include optional customerId filter. */
export const ServiceLogListQuery = ListServiceLogsQueryParams.extend({
  customerId: z
    .string()
    .regex(/^\d+$/, "customerId must be a positive integer")
    .transform(Number)
    .optional(),
});
export type ServiceLogListQueryType = z.infer<typeof ServiceLogListQuery>;

export type CreateServiceLogBodyType = z.infer<typeof CreateServiceLogBody>;
export type UpdateServiceLogBodyType = z.infer<typeof UpdateServiceLogBody>;
export type ServiceLogIdParamType = z.infer<typeof idParamSchema>;
