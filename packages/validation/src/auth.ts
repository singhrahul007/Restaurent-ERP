import { PASSWORD_MAX_LENGTH } from "@niva/auth";
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1).max(128),
  password: passwordSchema,
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
