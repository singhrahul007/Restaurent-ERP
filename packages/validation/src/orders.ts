import { z } from "zod";
import { basisPointsSchema, moneyMinorSchema } from "./menu.js";

export const createOrderItemBodySchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  modifierIds: z.array(z.string().uuid()).default([]),
  qty: z.number().int().min(1).max(99),
});

export const createOrderBodySchema = z.object({
  type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  status: z.enum(["DRAFT", "CREATED"]).optional(),
  tableId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(createOrderItemBodySchema).default([]),
  serviceChargeBps: basisPointsSchema.optional(),
});

export const patchOrderItemBodySchema = z.object({
  qty: z.number().int().min(1).max(99),
});

export const applyDiscountBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PERCENT"),
    percentBps: basisPointsSchema,
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({
    type: z.literal("AMOUNT"),
    amountMinor: moneyMinorSchema.min(0),
    reason: z.string().trim().max(200).optional(),
  }),
]);

export const applyCouponBodySchema = z.object({
  code: z.string().trim().min(1).max(40),
});

export const createCouponBodySchema = z
  .object({
    code: z.string().trim().min(1).max(40),
    percentBps: basisPointsSchema.optional(),
    amountMinor: moneyMinorSchema.min(0).optional(),
    maxRedemptions: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasPercent = value.percentBps !== undefined;
    const hasAmount = value.amountMinor !== undefined;
    if (hasPercent === hasAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either percentBps or amountMinor",
      });
    }
  });

export const createPaymentBodySchema = z.object({
  amountMinor: moneyMinorSchema.min(1),
  method: z.literal("CASH").default("CASH"),
});

export const createRefundBodySchema = z.object({
  amountMinor: moneyMinorSchema.min(1),
  reason: z.string().trim().max(200).optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type CreateOrderItemBody = z.infer<typeof createOrderItemBodySchema>;
export type PatchOrderItemBody = z.infer<typeof patchOrderItemBodySchema>;
export type ApplyDiscountBody = z.infer<typeof applyDiscountBodySchema>;
export type ApplyCouponBody = z.infer<typeof applyCouponBodySchema>;
export type CreateCouponBody = z.infer<typeof createCouponBodySchema>;
export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
export type CreateRefundBody = z.infer<typeof createRefundBodySchema>;

export const patchKitchenItemBodySchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "READY"]).optional(),
  assignedCookId: z.string().uuid().nullable().optional(),
  kitchenStationId: z.string().uuid().nullable().optional(),
});

export type PatchKitchenItemBody = z.infer<typeof patchKitchenItemBodySchema>;

export const createKitchenStationBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(32),
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#f59e0b"),
  sortOrder: z.number().int().default(0),
});

export type CreateKitchenStationBody = z.infer<typeof createKitchenStationBodySchema>;

