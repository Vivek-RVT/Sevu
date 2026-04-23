/**
 * Zod validation middleware.
 *
 * Usage:
 *   router.post("/path", validate({ body: MySchema, params: IdParamSchema }), handler);
 *
 * Attaches parsed+coerced values to req.validated.body / .query / .params
 * so handlers NEVER touch raw req.body / req.query / req.params.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z, ZodError } from "zod";

declare global {
  namespace Express {
    interface Request {
      validated: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

interface ValidationSchemas {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

function formatZodError(err: ZodError): { field: string; message: string }[] {
  return err.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }));
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.validated = { body: {}, query: {}, params: {} };

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        res.status(400).json({
          error: "Invalid input",
          details: formatZodError(result.error),
        });
        return;
      }
      req.validated.params = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        res.status(400).json({
          error: "Invalid input",
          details: formatZodError(result.error),
        });
        return;
      }
      req.validated.query = result.data;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Invalid input",
          details: formatZodError(result.error),
        });
        return;
      }
      req.validated.body = result.data;
    }

    next();
  };
}
