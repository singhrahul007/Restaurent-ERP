import { z } from "zod";

export const createReservationBodySchema = z.object({
  branchId: z.string().uuid(),
  guestName: z.string().min(1).max(128),
  guestPhone: z.string().min(5).max(32),
  partySize: z.number().int().min(1).max(100).default(2),
  reservationTime: z.string().datetime(),
  tableId: z.string().uuid().optional(),
  status: z.enum(["CONFIRMED", "WAITLISTED", "SEATED", "CANCELLED", "NO_SHOW"]).optional(),
  specialRequests: z.string().max(500).optional(),
});

export type CreateReservationBody = z.infer<typeof createReservationBodySchema>;

export const patchReservationBodySchema = z.object({
  status: z.enum(["CONFIRMED", "WAITLISTED", "SEATED", "CANCELLED", "NO_SHOW"]).optional(),
  tableId: z.string().uuid().nullable().optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  reservationTime: z.string().datetime().optional(),
  specialRequests: z.string().max(500).optional(),
});

export type PatchReservationBody = z.infer<typeof patchReservationBodySchema>;

