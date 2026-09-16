import { z } from "zod";

const qtySchema = z.number().int();

export const createUnitBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(80),
  dimension: z.enum(["MASS", "VOLUME", "COUNT"]),
});

export const createUnitConversionBodySchema = z.object({
  fromUnitId: z.string().uuid(),
  toUnitId: z.string().uuid(),
  numerator: z.number().int().min(1),
  denominator: z.number().int().min(1),
});

export const createInventoryItemBodySchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  baseUnitId: z.string().uuid(),
  trackStock: z.boolean().optional(),
  lowStockThreshold: qtySchema.min(0).nullable().optional(),
});

export const patchInventoryItemBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  trackStock: z.boolean().optional(),
  lowStockThreshold: qtySchema.min(0).nullable().optional(),
});

export const createInventoryTransactionBodySchema = z
  .object({
    type: z.enum(["ADJUSTMENT", "WASTAGE"]),
    inventoryItemId: z.string().uuid(),
    unitId: z.string().uuid(),
    qtyInUnit: qtySchema,
    reason: z.string().trim().min(1).max(300),
  })
  .superRefine((value, ctx) => {
    if (value.type === "WASTAGE" && value.qtyInUnit <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wastage quantity must be a positive integer",
        path: ["qtyInUnit"],
      });
    }
    if (value.type === "ADJUSTMENT" && value.qtyInUnit === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Adjustment quantity cannot be zero",
        path: ["qtyInUnit"],
      });
    }
  });

export const createSupplierBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(320).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const patchSupplierBodySchema = createSupplierBodySchema.partial();

export const createPurchaseOrderBodySchema = z.object({
  supplierId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        unitId: z.string().uuid(),
        qtyInUnit: qtySchema.min(1),
      }),
    )
    .min(1),
});

export const createTransferBodySchema = z.object({
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  unitId: z.string().uuid(),
  qtyInUnit: qtySchema.min(1),
});

export type CreateUnitBody = z.infer<typeof createUnitBodySchema>;
export type CreateUnitConversionBody = z.infer<typeof createUnitConversionBodySchema>;
export type CreateInventoryItemBody = z.infer<typeof createInventoryItemBodySchema>;
export type PatchInventoryItemBody = z.infer<typeof patchInventoryItemBodySchema>;
export type CreateInventoryTransactionBody = z.infer<
  typeof createInventoryTransactionBodySchema
>;
export type CreateSupplierBody = z.infer<typeof createSupplierBodySchema>;
export type PatchSupplierBody = z.infer<typeof patchSupplierBodySchema>;
export type CreatePurchaseOrderBody = z.infer<typeof createPurchaseOrderBodySchema>;
export type CreateTransferBody = z.infer<typeof createTransferBodySchema>;
