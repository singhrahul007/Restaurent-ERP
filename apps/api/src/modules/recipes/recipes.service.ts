import type { CreateRecipeBody, PatchRecipeBody } from "@niva/validation";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { MovementError } from "../inventory/inventory.repository.js";
import type { RecipeRepository } from "./recipes.repository.js";

function movementError(code: MovementError): never {
  if (code === "ITEM_NOT_FOUND") {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
  if (code === "INSUFFICIENT_STOCK") {
    throw new AppError("CONFLICT", "Insufficient stock to consume recipes", 409);
  }
  if (code === "UNIT_CONVERSION_MISSING") {
    throw new AppError("VALIDATION_ERROR", "No integer conversion between units", 400);
  }
  throw new AppError("VALIDATION_ERROR", "Conversion is not an integer quantity", 400);
}

export function assertRecipeMovement(error: MovementError | undefined) {
  if (error) {
    movementError(error);
  }
}

export function createRecipeService(recipes: RecipeRepository) {
  return {
    list(tenant: TenantContext, restaurantId: string) {
      return recipes.list(tenant.organizationId, restaurantId);
    },

    async create(tenant: TenantContext, restaurantId: string, body: CreateRecipeBody) {
      const menuItem = await recipes.findMenuItem(tenant.organizationId, body.menuItemId);
      if (!menuItem || menuItem.restaurantId !== restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (body.variantId) {
        const variant = await recipes.findVariant(tenant.organizationId, body.variantId);
        if (!variant || variant.menuItemId !== menuItem.id) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      for (const line of body.lines) {
        const stock = await recipes.findInventoryItem(
          tenant.organizationId,
          line.inventoryItemId,
        );
        if (!stock || stock.restaurantId !== restaurantId) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      try {
        return await recipes.insert({
          organizationId: tenant.organizationId,
          restaurantId,
          menuItemId: body.menuItemId,
          variantId: body.variantId,
          lines: body.lines,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Recipe already exists for this item", 409);
        }
        throw error;
      }
    },

    async patch(tenant: TenantContext, id: string, body: PatchRecipeBody) {
      const existing = await recipes.findById(tenant.organizationId, id);
      if (!existing) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      for (const line of body.lines) {
        const stock = await recipes.findInventoryItem(
          tenant.organizationId,
          line.inventoryItemId,
        );
        if (!stock || stock.restaurantId !== existing.restaurantId) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      const row = await recipes.replaceLines(tenant.organizationId, id, body.lines);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async remove(tenant: TenantContext, id: string) {
      const ok = await recipes.delete(tenant.organizationId, id);
      if (!ok) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },
  };
}

export type RecipeService = ReturnType<typeof createRecipeService>;
