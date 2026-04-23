import { z } from "zod";

/**
 * Indian phone: validates format but does NOT normalise the digits —
 * we preserve the user's input (trimmed) to match whatever was stored in the
 * DB at registration time ("+91 9876543210", "9876543210", etc.)
 */
const authPhone = z
  .string()
  .trim()
  .min(10, "Phone number is required")
  .max(15, "Phone number too long")
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    const mobile =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 10
          ? digits
          : null;
    return mobile !== null && /^[6-9]\d{9}$/.test(mobile);
  }, "Enter a valid 10-digit Indian mobile number starting with 6–9");

/** Password: min 8, max 72 (bcrypt ceiling). */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long (max 72 characters)");

/** OTP: exactly 6 numeric digits. */
const otp = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "OTP must be exactly 6 digits");

// ─── Per-route body schemas (strict — reject unknown keys) ─────────────────

export const CheckPhoneBody = z
  .object({ phone: authPhone })
  .strict();
export type CheckPhoneBodyType = z.infer<typeof CheckPhoneBody>;

export const SendOtpBody = z
  .object({ phone: authPhone })
  .strict();
export type SendOtpBodyType = z.infer<typeof SendOtpBody>;

export const CheckOtpBody = z
  .object({ phone: authPhone, otp })
  .strict();
export type CheckOtpBodyType = z.infer<typeof CheckOtpBody>;

export const RegisterBody = z
  .object({ phone: authPhone, otp, password })
  .strict();
export type RegisterBodyType = z.infer<typeof RegisterBody>;

export const VerifyPhoneBody = z
  .object({ phone: authPhone, otp })
  .strict();
export type VerifyPhoneBodyType = z.infer<typeof VerifyPhoneBody>;

export const LoginBody = z
  .object({ phone: authPhone, password })
  .strict();
export type LoginBodyType = z.infer<typeof LoginBody>;

export const ForgotPasswordBody = z
  .object({ phone: authPhone })
  .strict();
export type ForgotPasswordBodyType = z.infer<typeof ForgotPasswordBody>;

export const ResetPasswordBody = z
  .object({ phone: authPhone, otp, newPassword: password })
  .strict();
export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBody>;

export const LinkBusinessBody = z
  .object({
    businessId: z.union([
      z.number().int().positive("businessId must be a positive integer"),
      z
        .string()
        .regex(/^\d+$/, "businessId must be a positive integer")
        .transform(Number),
    ]),
  })
  .strict();
export type LinkBusinessBodyType = z.infer<typeof LinkBusinessBody>;

export const LogoutBody = z
  .object({
    revokeAll: z.boolean().optional().default(false),
  })
  .strict();
export type LogoutBodyType = z.infer<typeof LogoutBody>;
