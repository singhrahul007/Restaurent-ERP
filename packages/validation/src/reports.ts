import { z } from "zod";
import { moneyMinorSchema } from "./menu.js";

export const reportsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const createExpenseBodySchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(1).max(80),
  amountMinor: moneyMinorSchema.min(0),
  incurredAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const patchExpenseBodySchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(1).max(80).optional(),
  amountMinor: moneyMinorSchema.min(0).optional(),
  incurredAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
export type CreateExpenseBody = z.infer<typeof createExpenseBodySchema>;
export type PatchExpenseBody = z.infer<typeof patchExpenseBodySchema>;
