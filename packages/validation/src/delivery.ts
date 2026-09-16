import { z } from "zod";
import { moneyMinorSchema } from "./menu.js";

export const deliveryShiftBodySchema = z.object({
  online: z.boolean(),
});

export const assignDeliveryBodySchema = z.object({
  orderId: z.string().uuid(),
  agentUserId: z.string().uuid(),
  addressLine: z.string().trim().min(1).max(300),
  phone: z.string().trim().max(32).optional(),
  customerName: z.string().trim().max(120).optional(),
  codAmountMinor: moneyMinorSchema.min(0).optional(),
});

export const confirmDeliveryBodySchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
  codCollectedMinor: moneyMinorSchema.min(0),
});

export type DeliveryShiftBody = z.infer<typeof deliveryShiftBodySchema>;
export type AssignDeliveryBody = z.infer<typeof assignDeliveryBodySchema>;
export type ConfirmDeliveryBody = z.infer<typeof confirmDeliveryBodySchema>;
