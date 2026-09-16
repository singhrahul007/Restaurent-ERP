import { z } from "zod";

/** Integer minor units (paise). Rejects floats. */
export const moneyMinorSchema = z.number().int();

/** Integer basis points. 1800 = 18%. */
export const basisPointsSchema = z.number().int().min(0).max(10000);

const gstComponentsSchema = z.object({
  rateBps: basisPointsSchema,
  cgstBps: basisPointsSchema.optional(),
  sgstBps: basisPointsSchema.optional(),
  igstBps: basisPointsSchema.optional(),
});

function refineGstComponents(
  value: z.infer<typeof gstComponentsSchema>,
  ctx: z.RefinementCtx,
) {
  const cgst = value.cgstBps ?? 0;
  const sgst = value.sgstBps ?? 0;
  const igst = value.igstBps ?? 0;
  const components = cgst + sgst + igst;
  if (components > 0 && components !== value.rateBps) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CGST, SGST, and IGST basis points must sum to rateBps",
      path: ["rateBps"],
    });
  }
}

export const createTaxClassBodySchema = gstComponentsSchema
  .extend({
    name: z.string().trim().min(1).max(120),
    inclusive: z.boolean().optional(),
  })
  .superRefine(refineGstComponents);

export const patchTaxClassBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  inclusive: z.boolean().optional(),
});

export const createTaxRateBodySchema = gstComponentsSchema.superRefine(
  refineGstComponents,
);

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const patchCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const createMenuItemBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().uuid(),
  taxClassId: z.string().uuid(),
  basePriceMinor: moneyMinorSchema.min(0),
  available: z.boolean().optional(),
});

export const patchMenuItemBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  taxClassId: z.string().uuid().optional(),
  basePriceMinor: moneyMinorSchema.min(0).optional(),
  available: z.boolean().optional(),
});

export const createVariantBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(64).nullable().optional(),
  priceDeltaMinor: moneyMinorSchema,
  sortOrder: z.number().int().optional(),
});

export const patchVariantBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  priceDeltaMinor: moneyMinorSchema.optional(),
  sortOrder: z.number().int().optional(),
});

const modifierSelectSchema = z
  .object({
    minSelect: z.number().int().min(0).optional(),
    maxSelect: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minSelect !== undefined &&
      value.maxSelect !== undefined &&
      value.maxSelect < value.minSelect
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxSelect must be greater than or equal to minSelect",
        path: ["maxSelect"],
      });
    }
  });

export const createModifierGroupBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(0).default(1),
  })
  .superRefine((value, ctx) => {
    if (value.maxSelect < value.minSelect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxSelect must be greater than or equal to minSelect",
        path: ["maxSelect"],
      });
    }
  });

export const patchModifierGroupBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    minSelect: z.number().int().min(0).optional(),
    maxSelect: z.number().int().min(0).optional(),
  })
  .and(modifierSelectSchema);

export const createModifierBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  priceDeltaMinor: moneyMinorSchema,
  sortOrder: z.number().int().optional(),
});

export const patchModifierBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  priceDeltaMinor: moneyMinorSchema.optional(),
  sortOrder: z.number().int().optional(),
});

export const attachModifierGroupsBodySchema = z.object({
  modifierGroupIds: z.array(z.string().uuid()),
});

export const upsertAvailabilityBodySchema = z.object({
  available: z.boolean(),
  branchId: z.string().uuid().nullable().optional(),
});

export type CreateTaxClassBody = z.infer<typeof createTaxClassBodySchema>;
export type PatchTaxClassBody = z.infer<typeof patchTaxClassBodySchema>;
export type CreateTaxRateBody = z.infer<typeof createTaxRateBodySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type PatchCategoryBody = z.infer<typeof patchCategoryBodySchema>;
export type CreateMenuItemBody = z.infer<typeof createMenuItemBodySchema>;
export type PatchMenuItemBody = z.infer<typeof patchMenuItemBodySchema>;
export type CreateVariantBody = z.infer<typeof createVariantBodySchema>;
export type PatchVariantBody = z.infer<typeof patchVariantBodySchema>;
export type CreateModifierGroupBody = z.infer<typeof createModifierGroupBodySchema>;
export type PatchModifierGroupBody = z.infer<typeof patchModifierGroupBodySchema>;
export type CreateModifierBody = z.infer<typeof createModifierBodySchema>;
export type PatchModifierBody = z.infer<typeof patchModifierBodySchema>;
export type AttachModifierGroupsBody = z.infer<typeof attachModifierGroupsBodySchema>;
export type UpsertAvailabilityBody = z.infer<typeof upsertAvailabilityBodySchema>;
