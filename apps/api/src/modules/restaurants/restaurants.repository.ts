import { and, eq } from "drizzle-orm";
import {
  branches,
  restaurants,
  withOrganizationScope,
  type Database,
} from "@niva/database";

export function createRestaurantRepository(db: Database) {
  return {
    async insertRestaurant(input: {
      organizationId: string;
      name: string;
      currency?: string;
      timezone?: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(restaurants)
          .values({
            organizationId: input.organizationId,
            name: input.name,
            currency: input.currency,
            timezone: input.timezone,
          })
          .returning({
            id: restaurants.id,
            organizationId: restaurants.organizationId,
            name: restaurants.name,
            currency: restaurants.currency,
            timezone: restaurants.timezone,
          });
        if (!row) {
          throw new Error("RESTAURANT_INSERT_FAILED");
        }
        return row;
      });
    },

    async listRestaurants(organizationId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: restaurants.id,
            organizationId: restaurants.organizationId,
            name: restaurants.name,
            currency: restaurants.currency,
            timezone: restaurants.timezone,
          })
          .from(restaurants)
          .where(eq(restaurants.organizationId, organizationId)),
      );
    },

    async findRestaurant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: restaurants.id,
            organizationId: restaurants.organizationId,
            name: restaurants.name,
            currency: restaurants.currency,
            timezone: restaurants.timezone,
          })
          .from(restaurants)
          .where(
            and(eq(restaurants.id, id), eq(restaurants.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    async updateRestaurant(
      organizationId: string,
      id: string,
      patch: { name?: string; currency?: string; timezone?: string },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(restaurants)
          .set(patch)
          .where(
            and(eq(restaurants.id, id), eq(restaurants.organizationId, organizationId)),
          )
          .returning({
            id: restaurants.id,
            organizationId: restaurants.organizationId,
            name: restaurants.name,
            currency: restaurants.currency,
            timezone: restaurants.timezone,
          });
        return row ?? null;
      });
    },

    async deleteRestaurant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(restaurants)
          .where(
            and(eq(restaurants.id, id), eq(restaurants.organizationId, organizationId)),
          )
          .returning({ id: restaurants.id });
        return deleted.length > 0;
      });
    },

    async insertBranch(input: {
      organizationId: string;
      restaurantId: string;
      name: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(branches)
          .values(input)
          .returning({
            id: branches.id,
            organizationId: branches.organizationId,
            restaurantId: branches.restaurantId,
            name: branches.name,
          });
        if (!row) {
          throw new Error("BRANCH_INSERT_FAILED");
        }
        return row;
      });
    },

    async listBranches(
      organizationId: string,
      restaurantId: string,
      allowedBranchIds: string[] | null,
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const rows = await tx
          .select({
            id: branches.id,
            organizationId: branches.organizationId,
            restaurantId: branches.restaurantId,
            name: branches.name,
          })
          .from(branches)
          .where(
            and(
              eq(branches.organizationId, organizationId),
              eq(branches.restaurantId, restaurantId),
            ),
          );
        if (!allowedBranchIds) {
          return rows;
        }
        return rows.filter((row) => allowedBranchIds.includes(row.id));
      });
    },

    async findBranch(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: branches.id,
            organizationId: branches.organizationId,
            restaurantId: branches.restaurantId,
            name: branches.name,
          })
          .from(branches)
          .where(and(eq(branches.id, id), eq(branches.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    async updateBranch(organizationId: string, id: string, name: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(branches)
          .set({ name })
          .where(and(eq(branches.id, id), eq(branches.organizationId, organizationId)))
          .returning({
            id: branches.id,
            organizationId: branches.organizationId,
            restaurantId: branches.restaurantId,
            name: branches.name,
          });
        return row ?? null;
      });
    },

    async deleteBranch(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(branches)
          .where(and(eq(branches.id, id), eq(branches.organizationId, organizationId)))
          .returning({ id: branches.id });
        return deleted.length > 0;
      });
    },
  };
}

export type RestaurantRepository = ReturnType<typeof createRestaurantRepository>;
