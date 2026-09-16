import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  inventoryConsumptions,
  inventoryItems,
  inventoryTransactions,
  menuItems,
  menuItemVariants,
  orderItems,
  recipeLines,
  recipes,
  restaurantSettings,
  withOrganizationScope,
  type Database,
} from "@niva/database";
import { isUniqueViolation } from "../../lib/errors.js";
import {
  applyMovementInTx,
  type MovementError,
} from "../inventory/inventory.repository.js";

type OrgTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const recipeSelect = {
  id: recipes.id,
  organizationId: recipes.organizationId,
  restaurantId: recipes.restaurantId,
  menuItemId: recipes.menuItemId,
  variantId: recipes.variantId,
  createdAt: recipes.createdAt,
};

async function linesForRecipes(tx: OrgTx, recipeIds: string[]) {
  if (recipeIds.length === 0) {
    return [];
  }
  return tx
    .select({
      id: recipeLines.id,
      recipeId: recipeLines.recipeId,
      inventoryItemId: recipeLines.inventoryItemId,
      qtyBase: recipeLines.qtyBase,
    })
    .from(recipeLines)
    .where(inArray(recipeLines.recipeId, recipeIds));
}

async function findRecipeForLine(
  tx: OrgTx,
  organizationId: string,
  menuItemId: string,
  variantId: string | null,
) {
  if (variantId) {
    const [variantRecipe] = await tx
      .select(recipeSelect)
      .from(recipes)
      .where(
        and(
          eq(recipes.organizationId, organizationId),
          eq(recipes.menuItemId, menuItemId),
          eq(recipes.variantId, variantId),
        ),
      )
      .limit(1);
    if (variantRecipe) {
      return variantRecipe;
    }
  }
  const [base] = await tx
    .select(recipeSelect)
    .from(recipes)
    .where(
      and(
        eq(recipes.organizationId, organizationId),
        eq(recipes.menuItemId, menuItemId),
        isNull(recipes.variantId),
      ),
    )
    .limit(1);
  return base ?? null;
}

export async function consumeOrderInTx(
  tx: OrgTx,
  input: {
    organizationId: string;
    restaurantId: string;
    branchId: string;
    orderId: string;
    actorId: string;
  },
): Promise<{ status: "skipped" | "consumed" | "already"; error?: MovementError }> {
  const [settings] = await tx
    .select({ inventoryPolicy: restaurantSettings.inventoryPolicy })
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, input.restaurantId))
    .limit(1);
  if (!settings || settings.inventoryPolicy !== "ON_SALE") {
    return { status: "skipped" };
  }

  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.orderId}))`);

  const [existing] = await tx
    .select({ id: inventoryConsumptions.id })
    .from(inventoryConsumptions)
    .where(eq(inventoryConsumptions.orderId, input.orderId))
    .limit(1);
  if (existing) {
    return { status: "already" };
  }

  try {
    await tx.insert(inventoryConsumptions).values({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      orderId: input.orderId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: "already" };
    }
    throw error;
  }

  const items = await tx
    .select({
      menuItemId: orderItems.menuItemId,
      variantId: orderItems.variantId,
      qty: orderItems.qty,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, input.orderId));

  for (const item of items) {
    if (!item.menuItemId) {
      continue;
    }
    const recipe = await findRecipeForLine(
      tx,
      input.organizationId,
      item.menuItemId,
      item.variantId,
    );
    if (!recipe) {
      continue;
    }
    const lines = await tx
      .select({
        inventoryItemId: recipeLines.inventoryItemId,
        qtyBase: recipeLines.qtyBase,
      })
      .from(recipeLines)
      .where(eq(recipeLines.recipeId, recipe.id));
    for (const line of lines) {
      const [stockItem] = await tx
        .select({
          trackStock: inventoryItems.trackStock,
          baseUnitId: inventoryItems.baseUnitId,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, line.inventoryItemId))
        .limit(1);
      if (!stockItem?.trackStock) {
        continue;
      }
      const moved = await applyMovementInTx(tx, {
        organizationId: input.organizationId,
        inventoryItemId: line.inventoryItemId,
        branchId: input.branchId,
        type: "SALE_CONSUMPTION",
        qtyInUnit: line.qtyBase * item.qty,
        unitId: stockItem.baseUnitId,
        reason: "Order complete",
        actorId: input.actorId,
        referenceType: "order",
        referenceId: input.orderId,
      });
      if (moved.error) {
        return { status: "consumed", error: moved.error };
      }
    }
  }
  return { status: "consumed" };
}

export async function reverseOrderInTx(
  tx: OrgTx,
  input: {
    organizationId: string;
    orderId: string;
    actorId: string;
  },
): Promise<{ status: "skipped" | "reversed" | "already"; error?: MovementError }> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.orderId}))`);

  const [consumption] = await tx
    .select({
      id: inventoryConsumptions.id,
      reversedAt: inventoryConsumptions.reversedAt,
      branchId: inventoryConsumptions.branchId,
    })
    .from(inventoryConsumptions)
    .where(
      and(
        eq(inventoryConsumptions.organizationId, input.organizationId),
        eq(inventoryConsumptions.orderId, input.orderId),
      ),
    )
    .for("update")
    .limit(1);
  if (!consumption) {
    return { status: "skipped" };
  }
  if (consumption.reversedAt) {
    return { status: "already" };
  }

  const saleRows = await tx
    .select({
      inventoryItemId: inventoryTransactions.inventoryItemId,
      qtyInUnit: inventoryTransactions.qtyInUnit,
      unitId: inventoryTransactions.unitId,
    })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.organizationId, input.organizationId),
        eq(inventoryTransactions.referenceType, "order"),
        eq(inventoryTransactions.referenceId, input.orderId),
        eq(inventoryTransactions.type, "SALE_CONSUMPTION"),
      ),
    );

  for (const row of saleRows) {
    const moved = await applyMovementInTx(tx, {
      organizationId: input.organizationId,
      inventoryItemId: row.inventoryItemId,
      branchId: consumption.branchId,
      type: "RETURN",
      qtyInUnit: Math.abs(row.qtyInUnit),
      unitId: row.unitId,
      reason: "Refund reversal",
      actorId: input.actorId,
      referenceType: "order_reverse",
      referenceId: input.orderId,
    });
    if (moved.error) {
      return { status: "reversed", error: moved.error };
    }
  }

  await tx
    .update(inventoryConsumptions)
    .set({ reversedAt: new Date() })
    .where(eq(inventoryConsumptions.id, consumption.id));
  return { status: "reversed" };
}

export function createRecipeRepository(db: Database) {
  return {
    findMenuItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: menuItems.id,
            restaurantId: menuItems.restaurantId,
          })
          .from(menuItems)
          .where(and(eq(menuItems.id, id), eq(menuItems.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    findVariant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: menuItemVariants.id,
            menuItemId: menuItemVariants.menuItemId,
          })
          .from(menuItemVariants)
          .where(
            and(eq(menuItemVariants.id, id), eq(menuItemVariants.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findInventoryItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: inventoryItems.id,
            restaurantId: inventoryItems.restaurantId,
          })
          .from(inventoryItems)
          .where(
            and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    list(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const rows = await tx
          .select(recipeSelect)
          .from(recipes)
          .where(
            and(eq(recipes.organizationId, organizationId), eq(recipes.restaurantId, restaurantId)),
          );
        const lines = await linesForRecipes(
          tx,
          rows.map((row) => row.id),
        );
        return rows.map((row) => ({
          ...row,
          lines: lines.filter((line) => line.recipeId === row.id),
        }));
      });
    },

    findById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(recipeSelect)
          .from(recipes)
          .where(and(eq(recipes.id, id), eq(recipes.organizationId, organizationId)))
          .limit(1);
        if (!row) {
          return null;
        }
        const lines = await linesForRecipes(tx, [row.id]);
        return { ...row, lines };
      });
    },

    insert(input: {
      organizationId: string;
      restaurantId: string;
      menuItemId: string;
      variantId?: string | null;
      lines: Array<{ inventoryItemId: string; qtyBase: number }>;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(recipes)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            menuItemId: input.menuItemId,
            variantId: input.variantId ?? null,
          })
          .returning(recipeSelect);
        if (!row) {
          throw new Error("RECIPE_INSERT_FAILED");
        }
        await tx.insert(recipeLines).values(
          input.lines.map((line) => ({
            organizationId: input.organizationId,
            recipeId: row.id,
            inventoryItemId: line.inventoryItemId,
            qtyBase: line.qtyBase,
          })),
        );
        const lines = await linesForRecipes(tx, [row.id]);
        return { ...row, lines };
      });
    },

    replaceLines(
      organizationId: string,
      id: string,
      lines: Array<{ inventoryItemId: string; qtyBase: number }>,
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(recipeSelect)
          .from(recipes)
          .where(and(eq(recipes.id, id), eq(recipes.organizationId, organizationId)))
          .limit(1);
        if (!row) {
          return null;
        }
        await tx.delete(recipeLines).where(eq(recipeLines.recipeId, id));
        await tx.insert(recipeLines).values(
          lines.map((line) => ({
            organizationId,
            recipeId: id,
            inventoryItemId: line.inventoryItemId,
            qtyBase: line.qtyBase,
          })),
        );
        const nextLines = await linesForRecipes(tx, [id]);
        return { ...row, lines: nextLines };
      });
    },

    delete(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(recipes)
          .where(and(eq(recipes.id, id), eq(recipes.organizationId, organizationId)))
          .returning({ id: recipes.id });
        return deleted.length > 0;
      });
    },

    consumeOrder(input: {
      organizationId: string;
      restaurantId: string;
      branchId: string;
      orderId: string;
      actorId: string;
    }) {
      return withOrganizationScope(db, input.organizationId, (tx) =>
        consumeOrderInTx(tx, input),
      );
    },

    reverseOrder(input: { organizationId: string; orderId: string; actorId: string }) {
      return withOrganizationScope(db, input.organizationId, (tx) =>
        reverseOrderInTx(tx, input),
      );
    },
  };
}

export type RecipeRepository = ReturnType<typeof createRecipeRepository>;
