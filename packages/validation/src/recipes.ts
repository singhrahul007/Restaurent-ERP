import { z } from "zod";

const qtyBaseSchema = z.number().int().positive();

export const recipeLineBodySchema = z.object({
  inventoryItemId: z.string().uuid(),
  qtyBase: qtyBaseSchema,
});

export const createRecipeBodySchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  lines: z.array(recipeLineBodySchema).min(1),
});

export const patchRecipeBodySchema = z.object({
  lines: z.array(recipeLineBodySchema).min(1),
});

export type CreateRecipeBody = z.infer<typeof createRecipeBodySchema>;
export type PatchRecipeBody = z.infer<typeof patchRecipeBodySchema>;
