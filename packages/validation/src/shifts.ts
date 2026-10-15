import { z } from "zod";

export const openShiftBodySchema = z.object({
  branchId: z.string().uuid(),
  openingFloatMinor: z.number().int().nonnegative().default(0),
  notes: z.string().max(500).optional(),
});

export type OpenShiftBody = z.infer<typeof openShiftBodySchema>;

export const closeShiftBodySchema = z.object({
  actualCashMinor: z.number().int().nonnegative(),
  denominationCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  notes: z.string().max(500).optional(),
});

export type CloseShiftBody = z.infer<typeof closeShiftBodySchema>;

