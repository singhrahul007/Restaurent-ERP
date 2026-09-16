import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  menuAvailabilityOverrides,
  menuCategories,
  menuItemModifierGroups,
  menuItems,
  menuItemVariants,
  modifierGroups,
  modifiers,
  restaurants,
  taxClasses,
  taxRates,
  withOrganizationScope,
  type Database,
} from "@niva/database";

const taxClassSelect = {
  id: taxClasses.id,
  organizationId: taxClasses.organizationId,
  restaurantId: taxClasses.restaurantId,
  name: taxClasses.name,
  inclusive: taxClasses.inclusive,
};

const taxRateSelect = {
  id: taxRates.id,
  taxClassId: taxRates.taxClassId,
  rateBps: taxRates.rateBps,
  cgstBps: taxRates.cgstBps,
  sgstBps: taxRates.sgstBps,
  igstBps: taxRates.igstBps,
  effectiveFrom: taxRates.effectiveFrom,
  effectiveTo: taxRates.effectiveTo,
};

const categorySelect = {
  id: menuCategories.id,
  organizationId: menuCategories.organizationId,
  restaurantId: menuCategories.restaurantId,
  parentId: menuCategories.parentId,
  name: menuCategories.name,
  sortOrder: menuCategories.sortOrder,
};

const itemSelect = {
  id: menuItems.id,
  organizationId: menuItems.organizationId,
  restaurantId: menuItems.restaurantId,
  categoryId: menuItems.categoryId,
  taxClassId: menuItems.taxClassId,
  name: menuItems.name,
  description: menuItems.description,
  basePriceMinor: menuItems.basePriceMinor,
  available: menuItems.available,
};

const variantSelect = {
  id: menuItemVariants.id,
  organizationId: menuItemVariants.organizationId,
  menuItemId: menuItemVariants.menuItemId,
  name: menuItemVariants.name,
  sku: menuItemVariants.sku,
  priceDeltaMinor: menuItemVariants.priceDeltaMinor,
  sortOrder: menuItemVariants.sortOrder,
};

const groupSelect = {
  id: modifierGroups.id,
  organizationId: modifierGroups.organizationId,
  restaurantId: modifierGroups.restaurantId,
  name: modifierGroups.name,
  minSelect: modifierGroups.minSelect,
  maxSelect: modifierGroups.maxSelect,
};

const modifierSelect = {
  id: modifiers.id,
  organizationId: modifiers.organizationId,
  modifierGroupId: modifiers.modifierGroupId,
  name: modifiers.name,
  priceDeltaMinor: modifiers.priceDeltaMinor,
  sortOrder: modifiers.sortOrder,
};

export function createMenuRepository(db: Database) {
  return {
    findRestaurant(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ id: restaurants.id })
          .from(restaurants)
          .where(
            and(
              eq(restaurants.id, restaurantId),
              eq(restaurants.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    insertTaxClass(input: {
      organizationId: string;
      restaurantId: string;
      name: string;
      inclusive?: boolean;
      rateBps: number;
      cgstBps?: number;
      sgstBps?: number;
      igstBps?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [taxClass] = await tx
          .insert(taxClasses)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            name: input.name,
            inclusive: input.inclusive,
          })
          .returning(taxClassSelect);
        if (!taxClass) {
          throw new Error("TAX_CLASS_INSERT_FAILED");
        }
        const [rate] = await tx
          .insert(taxRates)
          .values({
            organizationId: input.organizationId,
            taxClassId: taxClass.id,
            rateBps: input.rateBps,
            cgstBps: input.cgstBps,
            sgstBps: input.sgstBps,
            igstBps: input.igstBps,
          })
          .returning(taxRateSelect);
        return { ...taxClass, currentRate: rate ?? null };
      });
    },

    async listTaxClasses(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const classes = await tx
          .select(taxClassSelect)
          .from(taxClasses)
          .where(
            and(
              eq(taxClasses.organizationId, organizationId),
              eq(taxClasses.restaurantId, restaurantId),
            ),
          );
        const rates = classes.length
          ? await tx
              .select(taxRateSelect)
              .from(taxRates)
              .where(
                inArray(
                  taxRates.taxClassId,
                  classes.map((row) => row.id),
                ),
              )
              .orderBy(desc(taxRates.effectiveFrom))
          : [];
        return classes.map((taxClass) => ({
          ...taxClass,
          currentRate:
            rates.find(
              (rate) => rate.taxClassId === taxClass.id && rate.effectiveTo === null,
            ) ??
            rates.find((rate) => rate.taxClassId === taxClass.id) ??
            null,
        }));
      });
    },

    findTaxClass(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(taxClassSelect)
          .from(taxClasses)
          .where(
            and(eq(taxClasses.id, id), eq(taxClasses.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    updateTaxClass(
      organizationId: string,
      id: string,
      patch: { name?: string; inclusive?: boolean },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(taxClasses)
          .set(patch)
          .where(and(eq(taxClasses.id, id), eq(taxClasses.organizationId, organizationId)))
          .returning(taxClassSelect);
        return row ?? null;
      });
    },

    deleteTaxClass(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(taxClasses)
          .where(and(eq(taxClasses.id, id), eq(taxClasses.organizationId, organizationId)))
          .returning({ id: taxClasses.id });
        return deleted.length > 0;
      });
    },

    insertTaxRate(input: {
      organizationId: string;
      taxClassId: string;
      rateBps: number;
      cgstBps?: number;
      sgstBps?: number;
      igstBps?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        await tx
          .update(taxRates)
          .set({ effectiveTo: new Date() })
          .where(
            and(
              eq(taxRates.taxClassId, input.taxClassId),
              eq(taxRates.organizationId, input.organizationId),
              isNull(taxRates.effectiveTo),
            ),
          );
        const [row] = await tx
          .insert(taxRates)
          .values({
            organizationId: input.organizationId,
            taxClassId: input.taxClassId,
            rateBps: input.rateBps,
            cgstBps: input.cgstBps,
            sgstBps: input.sgstBps,
            igstBps: input.igstBps,
          })
          .returning(taxRateSelect);
        if (!row) {
          throw new Error("TAX_RATE_INSERT_FAILED");
        }
        return row;
      });
    },

    insertCategory(input: {
      organizationId: string;
      restaurantId: string;
      name: string;
      parentId?: string | null;
      sortOrder?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(menuCategories)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            name: input.name,
            parentId: input.parentId,
            sortOrder: input.sortOrder,
          })
          .returning(categorySelect);
        if (!row) {
          throw new Error("CATEGORY_INSERT_FAILED");
        }
        return row;
      });
    },

    listCategories(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(categorySelect)
          .from(menuCategories)
          .where(
            and(
              eq(menuCategories.organizationId, organizationId),
              eq(menuCategories.restaurantId, restaurantId),
            ),
          )
          .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name)),
      );
    },

    findCategory(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(categorySelect)
          .from(menuCategories)
          .where(
            and(
              eq(menuCategories.id, id),
              eq(menuCategories.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    updateCategory(
      organizationId: string,
      id: string,
      patch: { name?: string; parentId?: string | null; sortOrder?: number },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(menuCategories)
          .set(patch)
          .where(
            and(
              eq(menuCategories.id, id),
              eq(menuCategories.organizationId, organizationId),
            ),
          )
          .returning(categorySelect);
        return row ?? null;
      });
    },

    deleteCategory(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(menuCategories)
          .where(
            and(
              eq(menuCategories.id, id),
              eq(menuCategories.organizationId, organizationId),
            ),
          )
          .returning({ id: menuCategories.id });
        return deleted.length > 0;
      });
    },

    insertItem(input: {
      organizationId: string;
      restaurantId: string;
      categoryId: string;
      taxClassId: string;
      name: string;
      description?: string | null;
      basePriceMinor: number;
      available?: boolean;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx.insert(menuItems).values(input).returning(itemSelect);
        if (!row) {
          throw new Error("MENU_ITEM_INSERT_FAILED");
        }
        return row;
      });
    },

    listItems(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(itemSelect)
          .from(menuItems)
          .where(
            and(
              eq(menuItems.organizationId, organizationId),
              eq(menuItems.restaurantId, restaurantId),
            ),
          )
          .orderBy(asc(menuItems.name)),
      );
    },

    findItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(itemSelect)
          .from(menuItems)
          .where(and(eq(menuItems.id, id), eq(menuItems.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    updateItem(
      organizationId: string,
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
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(menuItems)
          .set(patch)
          .where(and(eq(menuItems.id, id), eq(menuItems.organizationId, organizationId)))
          .returning(itemSelect);
        return row ?? null;
      });
    },

    deleteItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(menuItems)
          .where(and(eq(menuItems.id, id), eq(menuItems.organizationId, organizationId)))
          .returning({ id: menuItems.id });
        return deleted.length > 0;
      });
    },

    insertVariant(input: {
      organizationId: string;
      menuItemId: string;
      name: string;
      sku?: string | null;
      priceDeltaMinor: number;
      sortOrder?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(menuItemVariants)
          .values(input)
          .returning(variantSelect);
        if (!row) {
          throw new Error("VARIANT_INSERT_FAILED");
        }
        return row;
      });
    },

    listVariants(organizationId: string, menuItemId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(variantSelect)
          .from(menuItemVariants)
          .where(
            and(
              eq(menuItemVariants.organizationId, organizationId),
              eq(menuItemVariants.menuItemId, menuItemId),
            ),
          )
          .orderBy(asc(menuItemVariants.sortOrder), asc(menuItemVariants.name)),
      );
    },

    findVariant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(variantSelect)
          .from(menuItemVariants)
          .where(
            and(
              eq(menuItemVariants.id, id),
              eq(menuItemVariants.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    updateVariant(
      organizationId: string,
      id: string,
      patch: {
        name?: string;
        sku?: string | null;
        priceDeltaMinor?: number;
        sortOrder?: number;
      },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(menuItemVariants)
          .set(patch)
          .where(
            and(
              eq(menuItemVariants.id, id),
              eq(menuItemVariants.organizationId, organizationId),
            ),
          )
          .returning(variantSelect);
        return row ?? null;
      });
    },

    deleteVariant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(menuItemVariants)
          .where(
            and(
              eq(menuItemVariants.id, id),
              eq(menuItemVariants.organizationId, organizationId),
            ),
          )
          .returning({ id: menuItemVariants.id });
        return deleted.length > 0;
      });
    },

    insertModifierGroup(input: {
      organizationId: string;
      restaurantId: string;
      name: string;
      minSelect: number;
      maxSelect: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(modifierGroups)
          .values(input)
          .returning(groupSelect);
        if (!row) {
          throw new Error("MODIFIER_GROUP_INSERT_FAILED");
        }
        return row;
      });
    },

    listModifierGroups(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(groupSelect)
          .from(modifierGroups)
          .where(
            and(
              eq(modifierGroups.organizationId, organizationId),
              eq(modifierGroups.restaurantId, restaurantId),
            ),
          )
          .orderBy(asc(modifierGroups.name)),
      );
    },

    findModifierGroup(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(groupSelect)
          .from(modifierGroups)
          .where(
            and(
              eq(modifierGroups.id, id),
              eq(modifierGroups.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    updateModifierGroup(
      organizationId: string,
      id: string,
      patch: { name?: string; minSelect?: number; maxSelect?: number },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(modifierGroups)
          .set(patch)
          .where(
            and(
              eq(modifierGroups.id, id),
              eq(modifierGroups.organizationId, organizationId),
            ),
          )
          .returning(groupSelect);
        return row ?? null;
      });
    },

    deleteModifierGroup(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(modifierGroups)
          .where(
            and(
              eq(modifierGroups.id, id),
              eq(modifierGroups.organizationId, organizationId),
            ),
          )
          .returning({ id: modifierGroups.id });
        return deleted.length > 0;
      });
    },

    insertModifier(input: {
      organizationId: string;
      modifierGroupId: string;
      name: string;
      priceDeltaMinor: number;
      sortOrder?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx.insert(modifiers).values(input).returning(modifierSelect);
        if (!row) {
          throw new Error("MODIFIER_INSERT_FAILED");
        }
        return row;
      });
    },

    listModifiers(organizationId: string, modifierGroupId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(modifierSelect)
          .from(modifiers)
          .where(
            and(
              eq(modifiers.organizationId, organizationId),
              eq(modifiers.modifierGroupId, modifierGroupId),
            ),
          )
          .orderBy(asc(modifiers.sortOrder), asc(modifiers.name)),
      );
    },

    listModifiersForGroups(organizationId: string, groupIds: string[]) {
      if (groupIds.length === 0) {
        return Promise.resolve([]);
      }
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(modifierSelect)
          .from(modifiers)
          .where(
            and(
              eq(modifiers.organizationId, organizationId),
              inArray(modifiers.modifierGroupId, groupIds),
            ),
          )
          .orderBy(asc(modifiers.sortOrder), asc(modifiers.name)),
      );
    },

    findModifier(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(modifierSelect)
          .from(modifiers)
          .where(and(eq(modifiers.id, id), eq(modifiers.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    updateModifier(
      organizationId: string,
      id: string,
      patch: { name?: string; priceDeltaMinor?: number; sortOrder?: number },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(modifiers)
          .set(patch)
          .where(and(eq(modifiers.id, id), eq(modifiers.organizationId, organizationId)))
          .returning(modifierSelect);
        return row ?? null;
      });
    },

    deleteModifier(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(modifiers)
          .where(and(eq(modifiers.id, id), eq(modifiers.organizationId, organizationId)))
          .returning({ id: modifiers.id });
        return deleted.length > 0;
      });
    },

    listItemGroupIds(organizationId: string, menuItemId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const rows = await tx
          .select({ modifierGroupId: menuItemModifierGroups.modifierGroupId })
          .from(menuItemModifierGroups)
          .where(
            and(
              eq(menuItemModifierGroups.organizationId, organizationId),
              eq(menuItemModifierGroups.menuItemId, menuItemId),
            ),
          );
        return rows.map((row) => row.modifierGroupId);
      });
    },

    replaceItemGroups(
      organizationId: string,
      menuItemId: string,
      modifierGroupIds: string[],
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        await tx
          .delete(menuItemModifierGroups)
          .where(
            and(
              eq(menuItemModifierGroups.organizationId, organizationId),
              eq(menuItemModifierGroups.menuItemId, menuItemId),
            ),
          );
        if (modifierGroupIds.length === 0) {
          return [];
        }
        return tx
          .insert(menuItemModifierGroups)
          .values(
            modifierGroupIds.map((modifierGroupId) => ({
              organizationId,
              menuItemId,
              modifierGroupId,
            })),
          )
          .returning({
            menuItemId: menuItemModifierGroups.menuItemId,
            modifierGroupId: menuItemModifierGroups.modifierGroupId,
          });
      });
    },

    listAvailability(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: menuAvailabilityOverrides.id,
            menuItemId: menuAvailabilityOverrides.menuItemId,
            restaurantId: menuAvailabilityOverrides.restaurantId,
            branchId: menuAvailabilityOverrides.branchId,
            available: menuAvailabilityOverrides.available,
          })
          .from(menuAvailabilityOverrides)
          .where(
            and(
              eq(menuAvailabilityOverrides.organizationId, organizationId),
              eq(menuAvailabilityOverrides.restaurantId, restaurantId),
            ),
          ),
      );
    },

    listItemAvailability(organizationId: string, menuItemId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: menuAvailabilityOverrides.id,
            menuItemId: menuAvailabilityOverrides.menuItemId,
            restaurantId: menuAvailabilityOverrides.restaurantId,
            branchId: menuAvailabilityOverrides.branchId,
            available: menuAvailabilityOverrides.available,
          })
          .from(menuAvailabilityOverrides)
          .where(
            and(
              eq(menuAvailabilityOverrides.organizationId, organizationId),
              eq(menuAvailabilityOverrides.menuItemId, menuItemId),
            ),
          ),
      );
    },

    upsertAvailability(input: {
      organizationId: string;
      restaurantId: string;
      menuItemId: string;
      branchId: string | null;
      available: boolean;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const match = input.branchId
          ? and(
              eq(menuAvailabilityOverrides.organizationId, input.organizationId),
              eq(menuAvailabilityOverrides.menuItemId, input.menuItemId),
              eq(menuAvailabilityOverrides.branchId, input.branchId),
            )
          : and(
              eq(menuAvailabilityOverrides.organizationId, input.organizationId),
              eq(menuAvailabilityOverrides.menuItemId, input.menuItemId),
              isNull(menuAvailabilityOverrides.branchId),
            );
        const [existing] = await tx
          .select({ id: menuAvailabilityOverrides.id })
          .from(menuAvailabilityOverrides)
          .where(match)
          .limit(1);
        if (existing) {
          const [row] = await tx
            .update(menuAvailabilityOverrides)
            .set({ available: input.available })
            .where(eq(menuAvailabilityOverrides.id, existing.id))
            .returning({
              id: menuAvailabilityOverrides.id,
              menuItemId: menuAvailabilityOverrides.menuItemId,
              restaurantId: menuAvailabilityOverrides.restaurantId,
              branchId: menuAvailabilityOverrides.branchId,
              available: menuAvailabilityOverrides.available,
            });
          return row ?? null;
        }
        const [row] = await tx
          .insert(menuAvailabilityOverrides)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            menuItemId: input.menuItemId,
            branchId: input.branchId,
            available: input.available,
          })
          .returning({
            id: menuAvailabilityOverrides.id,
            menuItemId: menuAvailabilityOverrides.menuItemId,
            restaurantId: menuAvailabilityOverrides.restaurantId,
            branchId: menuAvailabilityOverrides.branchId,
            available: menuAvailabilityOverrides.available,
          });
        return row ?? null;
      });
    },

    deleteAvailability(
      organizationId: string,
      menuItemId: string,
      branchId: string | null,
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const match = branchId
          ? and(
              eq(menuAvailabilityOverrides.organizationId, organizationId),
              eq(menuAvailabilityOverrides.menuItemId, menuItemId),
              eq(menuAvailabilityOverrides.branchId, branchId),
            )
          : and(
              eq(menuAvailabilityOverrides.organizationId, organizationId),
              eq(menuAvailabilityOverrides.menuItemId, menuItemId),
              isNull(menuAvailabilityOverrides.branchId),
            );
        const deleted = await tx
          .delete(menuAvailabilityOverrides)
          .where(match)
          .returning({ id: menuAvailabilityOverrides.id });
        return deleted.length > 0;
      });
    },
  };
}

export type MenuRepository = ReturnType<typeof createMenuRepository>;
