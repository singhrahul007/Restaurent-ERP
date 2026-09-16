import { and, desc, eq } from "drizzle-orm";
import {
  branches,
  expenses,
  restaurants,
  withOrganizationScope,
  type Database,
} from "@niva/database";

const expenseSelect = {
  id: expenses.id,
  organizationId: expenses.organizationId,
  restaurantId: expenses.restaurantId,
  branchId: expenses.branchId,
  category: expenses.category,
  amountMinor: expenses.amountMinor,
  incurredAt: expenses.incurredAt,
  notes: expenses.notes,
  createdAt: expenses.createdAt,
};

export function createExpenseRepository(db: Database) {
  return {
    findRestaurant(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ id: restaurants.id })
          .from(restaurants)
          .where(
            and(eq(restaurants.id, restaurantId), eq(restaurants.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findBranch(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: branches.id,
            restaurantId: branches.restaurantId,
          })
          .from(branches)
          .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    list(organizationId: string, restaurantId: string, branchId?: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const filters = [
          eq(expenses.organizationId, organizationId),
          eq(expenses.restaurantId, restaurantId),
        ];
        if (branchId) {
          filters.push(eq(expenses.branchId, branchId));
        }
        return tx
          .select(expenseSelect)
          .from(expenses)
          .where(and(...filters))
          .orderBy(desc(expenses.incurredAt));
      });
    },

    findById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(expenseSelect)
          .from(expenses)
          .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    insert(input: {
      organizationId: string;
      restaurantId: string;
      branchId?: string | null;
      category: string;
      amountMinor: number;
      incurredAt?: Date;
      notes?: string;
      createdBy: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(expenses)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            category: input.category,
            amountMinor: input.amountMinor,
            incurredAt: input.incurredAt,
            notes: input.notes,
            createdBy: input.createdBy,
          })
          .returning(expenseSelect);
        if (!row) {
          throw new Error("EXPENSE_INSERT_FAILED");
        }
        return row;
      });
    },

    update(
      organizationId: string,
      id: string,
      patch: {
        branchId?: string | null;
        category?: string;
        amountMinor?: number;
        incurredAt?: Date;
        notes?: string | null;
      },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(expenses)
          .set(patch)
          .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
          .returning(expenseSelect);
        return row ?? null;
      });
    },

    remove(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .delete(expenses)
          .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
          .returning({ id: expenses.id });
        return row ?? null;
      });
    },
  };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
