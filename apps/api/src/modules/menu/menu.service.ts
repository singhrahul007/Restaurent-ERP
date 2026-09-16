import { AppError, isUniqueViolation } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { MenuRepository } from "./menu.repository.js";

function isFkViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") {
      return false;
    }
    const code = "code" in current ? current.code : undefined;
    if (code === "23503") {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export function effectiveItemAvailable(
  itemAvailable: boolean,
  overlays: Array<{ menuItemId: string; branchId: string | null; available: boolean }>,
  menuItemId: string,
  branchId?: string,
): boolean {
  const restaurantOverlay = overlays.find(
    (row) => row.menuItemId === menuItemId && row.branchId === null,
  );
  const branchOverlay = branchId
    ? overlays.find((row) => row.menuItemId === menuItemId && row.branchId === branchId)
    : undefined;
  if (branchOverlay) {
    return branchOverlay.available;
  }
  if (restaurantOverlay) {
    return restaurantOverlay.available;
  }
  return itemAvailable;
}

export function createMenuService(menu: MenuRepository) {
  async function requireRestaurant(tenant: TenantContext, restaurantId: string) {
    const restaurant = await menu.findRestaurant(tenant.organizationId, restaurantId);
    if (!restaurant) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
  }

  async function requireCategoryInRestaurant(
    tenant: TenantContext,
    restaurantId: string,
    categoryId: string,
  ) {
    const category = await menu.findCategory(tenant.organizationId, categoryId);
    if (!category || category.restaurantId !== restaurantId) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return category;
  }

  async function requireTaxClassInRestaurant(
    tenant: TenantContext,
    restaurantId: string,
    taxClassId: string,
  ) {
    const taxClass = await menu.findTaxClass(tenant.organizationId, taxClassId);
    if (!taxClass || taxClass.restaurantId !== restaurantId) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return taxClass;
  }

  async function wouldCycle(
    tenant: TenantContext,
    categoryId: string,
    parentId: string,
  ): Promise<boolean> {
    let current: string | null = parentId;
    const seen = new Set<string>([categoryId]);
    while (current) {
      if (seen.has(current)) {
        return true;
      }
      seen.add(current);
      const row = await menu.findCategory(tenant.organizationId, current);
      current = row?.parentId ?? null;
    }
    return false;
  }

  return {
    async listTaxClasses(tenant: TenantContext, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      return menu.listTaxClasses(tenant.organizationId, restaurantId);
    },

    async createTaxClass(
      tenant: TenantContext,
      restaurantId: string,
      input: {
        name: string;
        inclusive?: boolean;
        rateBps: number;
        cgstBps?: number;
        sgstBps?: number;
        igstBps?: number;
      },
    ) {
      await requireRestaurant(tenant, restaurantId);
      return menu.insertTaxClass({
        organizationId: tenant.organizationId,
        restaurantId,
        ...input,
      });
    },

    async updateTaxClass(
      tenant: TenantContext,
      id: string,
      patch: { name?: string; inclusive?: boolean },
    ) {
      const row = await menu.updateTaxClass(tenant.organizationId, id, patch);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeTaxClass(tenant: TenantContext, id: string) {
      try {
        const deleted = await menu.deleteTaxClass(tenant.organizationId, id);
        if (!deleted) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      } catch (error) {
        if (isFkViolation(error)) {
          throw new AppError("CONFLICT", "Tax class is in use", 409);
        }
        throw error;
      }
    },

    async addTaxRate(
      tenant: TenantContext,
      taxClassId: string,
      input: {
        rateBps: number;
        cgstBps?: number;
        sgstBps?: number;
        igstBps?: number;
      },
    ) {
      const taxClass = await menu.findTaxClass(tenant.organizationId, taxClassId);
      if (!taxClass) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return menu.insertTaxRate({
        organizationId: tenant.organizationId,
        taxClassId,
        ...input,
      });
    },

    async listCategories(tenant: TenantContext, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      return menu.listCategories(tenant.organizationId, restaurantId);
    },

    async createCategory(
      tenant: TenantContext,
      restaurantId: string,
      input: { name: string; parentId?: string | null; sortOrder?: number },
    ) {
      await requireRestaurant(tenant, restaurantId);
      if (input.parentId) {
        await requireCategoryInRestaurant(tenant, restaurantId, input.parentId);
      }
      return menu.insertCategory({
        organizationId: tenant.organizationId,
        restaurantId,
        ...input,
      });
    },

    async updateCategory(
      tenant: TenantContext,
      id: string,
      patch: { name?: string; parentId?: string | null; sortOrder?: number },
    ) {
      const existing = await menu.findCategory(tenant.organizationId, id);
      if (!existing) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (patch.parentId) {
        if (patch.parentId === id) {
          throw new AppError("VALIDATION_ERROR", "Category cannot be its own parent", 400);
        }
        await requireCategoryInRestaurant(
          tenant,
          existing.restaurantId,
          patch.parentId,
        );
        if (await wouldCycle(tenant, id, patch.parentId)) {
          throw new AppError("VALIDATION_ERROR", "Category parent would create a cycle", 400);
        }
      }
      const row = await menu.updateCategory(tenant.organizationId, id, patch);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeCategory(tenant: TenantContext, id: string) {
      try {
        const deleted = await menu.deleteCategory(tenant.organizationId, id);
        if (!deleted) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      } catch (error) {
        if (isFkViolation(error)) {
          throw new AppError("CONFLICT", "Category is in use", 409);
        }
        throw error;
      }
    },

    async listItems(tenant: TenantContext, restaurantId: string, branchId?: string) {
      await requireRestaurant(tenant, restaurantId);
      const [items, overlays] = await Promise.all([
        menu.listItems(tenant.organizationId, restaurantId),
        menu.listAvailability(tenant.organizationId, restaurantId),
      ]);
      return items.map((item) => ({
        ...item,
        effectiveAvailable: effectiveItemAvailable(
          item.available,
          overlays,
          item.id,
          branchId,
        ),
      }));
    },

    async getItem(tenant: TenantContext, id: string) {
      const item = await menu.findItem(tenant.organizationId, id);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const [variants, groupIds, availability, restaurantGroups] = await Promise.all([
        menu.listVariants(tenant.organizationId, item.id),
        menu.listItemGroupIds(tenant.organizationId, item.id),
        menu.listItemAvailability(tenant.organizationId, item.id),
        menu.listModifierGroups(tenant.organizationId, item.restaurantId),
      ]);
      const attached = restaurantGroups.filter((group) => groupIds.includes(group.id));
      const modifiers = await menu.listModifiersForGroups(
        tenant.organizationId,
        attached.map((group) => group.id),
      );
      return {
        ...item,
        variants,
        modifierGroups: attached.map((group) => ({
          ...group,
          modifiers: modifiers.filter((row) => row.modifierGroupId === group.id),
        })),
        availability,
      };
    },

    async createItem(
      tenant: TenantContext,
      restaurantId: string,
      input: {
        name: string;
        description?: string | null;
        categoryId: string;
        taxClassId: string;
        basePriceMinor: number;
        available?: boolean;
      },
    ) {
      await requireRestaurant(tenant, restaurantId);
      await requireCategoryInRestaurant(tenant, restaurantId, input.categoryId);
      await requireTaxClassInRestaurant(tenant, restaurantId, input.taxClassId);
      return menu.insertItem({
        organizationId: tenant.organizationId,
        restaurantId,
        ...input,
      });
    },

    async updateItem(
      tenant: TenantContext,
      id: string,
      patch: {
        name?: string;
        description?: string | null;
        categoryId?: string;
        taxClassId?: string;
        basePriceMinor?: number;
        available?: boolean;
      },
    ) {
      const existing = await menu.findItem(tenant.organizationId, id);
      if (!existing) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (patch.categoryId) {
        await requireCategoryInRestaurant(
          tenant,
          existing.restaurantId,
          patch.categoryId,
        );
      }
      if (patch.taxClassId) {
        await requireTaxClassInRestaurant(
          tenant,
          existing.restaurantId,
          patch.taxClassId,
        );
      }
      const row = await menu.updateItem(tenant.organizationId, id, patch);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeItem(tenant: TenantContext, id: string) {
      const deleted = await menu.deleteItem(tenant.organizationId, id);
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async createVariant(
      tenant: TenantContext,
      menuItemId: string,
      input: {
        name: string;
        sku?: string | null;
        priceDeltaMinor: number;
        sortOrder?: number;
      },
    ) {
      const item = await menu.findItem(tenant.organizationId, menuItemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return menu.insertVariant({
        organizationId: tenant.organizationId,
        menuItemId,
        ...input,
      });
    },

    async updateVariant(
      tenant: TenantContext,
      id: string,
      patch: {
        name?: string;
        sku?: string | null;
        priceDeltaMinor?: number;
        sortOrder?: number;
      },
    ) {
      const row = await menu.updateVariant(tenant.organizationId, id, patch);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeVariant(tenant: TenantContext, id: string) {
      const deleted = await menu.deleteVariant(tenant.organizationId, id);
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async listModifierGroups(tenant: TenantContext, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      const groups = await menu.listModifierGroups(tenant.organizationId, restaurantId);
      const modifiers = await menu.listModifiersForGroups(
        tenant.organizationId,
        groups.map((group) => group.id),
      );
      return groups.map((group) => ({
        ...group,
        modifiers: modifiers.filter((row) => row.modifierGroupId === group.id),
      }));
    },

    async createModifierGroup(
      tenant: TenantContext,
      restaurantId: string,
      input: { name: string; minSelect: number; maxSelect: number },
    ) {
      await requireRestaurant(tenant, restaurantId);
      return menu.insertModifierGroup({
        organizationId: tenant.organizationId,
        restaurantId,
        ...input,
      });
    },

    async updateModifierGroup(
      tenant: TenantContext,
      id: string,
      patch: { name?: string; minSelect?: number; maxSelect?: number },
    ) {
      const existing = await menu.findModifierGroup(tenant.organizationId, id);
      if (!existing) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const minSelect = patch.minSelect ?? existing.minSelect;
      const maxSelect = patch.maxSelect ?? existing.maxSelect;
      if (maxSelect < minSelect) {
        throw new AppError(
          "VALIDATION_ERROR",
          "maxSelect must be greater than or equal to minSelect",
          400,
        );
      }
      const row = await menu.updateModifierGroup(tenant.organizationId, id, {
        ...patch,
        minSelect,
        maxSelect,
      });
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeModifierGroup(tenant: TenantContext, id: string) {
      const deleted = await menu.deleteModifierGroup(tenant.organizationId, id);
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async createModifier(
      tenant: TenantContext,
      modifierGroupId: string,
      input: { name: string; priceDeltaMinor: number; sortOrder?: number },
    ) {
      const group = await menu.findModifierGroup(tenant.organizationId, modifierGroupId);
      if (!group) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return menu.insertModifier({
        organizationId: tenant.organizationId,
        modifierGroupId,
        ...input,
      });
    },

    async updateModifier(
      tenant: TenantContext,
      id: string,
      patch: { name?: string; priceDeltaMinor?: number; sortOrder?: number },
    ) {
      const row = await menu.updateModifier(tenant.organizationId, id, patch);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeModifier(tenant: TenantContext, id: string) {
      const deleted = await menu.deleteModifier(tenant.organizationId, id);
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async attachModifierGroups(
      tenant: TenantContext,
      menuItemId: string,
      modifierGroupIds: string[],
    ) {
      const item = await menu.findItem(tenant.organizationId, menuItemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      for (const groupId of modifierGroupIds) {
        const group = await menu.findModifierGroup(tenant.organizationId, groupId);
        if (!group || group.restaurantId !== item.restaurantId) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      try {
        await menu.replaceItemGroups(
          tenant.organizationId,
          menuItemId,
          modifierGroupIds,
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Modifier group already attached", 409);
        }
        throw error;
      }
      return this.getItem(tenant, menuItemId);
    },

    async setAvailability(
      tenant: TenantContext,
      menuItemId: string,
      input: { available: boolean; branchId?: string | null },
    ) {
      const item = await menu.findItem(tenant.organizationId, menuItemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (input.branchId && tenant.allowedBranchIds) {
        if (!tenant.allowedBranchIds.includes(input.branchId)) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      return menu.upsertAvailability({
        organizationId: tenant.organizationId,
        restaurantId: item.restaurantId,
        menuItemId,
        branchId: input.branchId ?? null,
        available: input.available,
      });
    },

    async clearAvailability(
      tenant: TenantContext,
      menuItemId: string,
      branchId: string | null,
    ) {
      const item = await menu.findItem(tenant.organizationId, menuItemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const deleted = await menu.deleteAvailability(
        tenant.organizationId,
        menuItemId,
        branchId,
      );
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async listMenu(tenant: TenantContext, restaurantId: string, branchId?: string) {
      await requireRestaurant(tenant, restaurantId);
      const [categories, items, taxClassList, groups] = await Promise.all([
        this.listCategories(tenant, restaurantId),
        this.listItems(tenant, restaurantId, branchId),
        this.listTaxClasses(tenant, restaurantId),
        this.listModifierGroups(tenant, restaurantId),
      ]);
      return { categories, items, taxClasses: taxClassList, modifierGroups: groups };
    },
  };
}

export type MenuService = ReturnType<typeof createMenuService>;
