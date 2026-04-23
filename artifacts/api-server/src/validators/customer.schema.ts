import { z } from "zod";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  ListCustomersQueryParams,
} from "@workspace/api-zod";
import { idParamSchema } from "./common.schema.js";

export { CreateCustomerBody, UpdateCustomerBody, ListCustomersQueryParams };
export { idParamSchema as CustomerIdParam };

/** Inferred types for use in route handlers. */
export type CreateCustomerBodyType = z.infer<typeof CreateCustomerBody>;
export type UpdateCustomerBodyType = z.infer<typeof UpdateCustomerBody>;
export type ListCustomersQueryType = z.infer<typeof ListCustomersQueryParams>;
export type CustomerIdParamType = z.infer<typeof idParamSchema>;
