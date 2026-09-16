import { and, eq } from "drizzle-orm";
import {
  branches,
  diningTables,
  restaurantSettings,
  restaurants,
  withOrganizationScope,
  type Database,
} from "@niva/database";

export type RestaurantSettingsPatch = {
  timezone?: string;
  currency?: string;
  taxInclusive?: boolean;
  kitchenSoundEnabled?: boolean;
  inventoryPolicy?: "OFF" | "ON_SALE" | "MANUAL";
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

const restaurantSelect = {
  id: restaurants.id,
  organizationId: restaurants.organizationId,
  name: restaurants.name,
  currency: restaurants.currency,
  timezone: restaurants.timezone,
  taxInclusive: restaurantSettings.taxInclusive,
  kitchenSoundEnabled: restaurantSettings.kitchenSoundEnabled,
  inventoryPolicy: restaurantSettings.inventoryPolicy,
  addressLine1: restaurantSettings.addressLine1,
  addressLine2: restaurantSettings.addressLine2,
  city: restaurantSettings.city,
  region: restaurantSettings.region,
  postalCode: restaurantSettings.postalCode,
  country: restaurantSettings.country,
};

const branchSelect = {
  id: branches.id,
  organizationId: branches.organizationId,
  restaurantId: branches.restaurantId,
  name: branches.name,
  posIdleTimeoutMinutes: branches.posIdleTimeoutMinutes,
};

export function createRestaurantRepository(db: Database) {
  return {
    async insertRestaurant(input: {
      organizationId: string;
      name: string;
      currency?: string;
      timezone?: string;
      taxInclusive?: boolean;
      kitchenSoundEnabled?: boolean;
      inventoryPolicy?: "OFF" | "ON_SALE" | "MANUAL";
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
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
        await tx.insert(restaurantSettings).values({
          organizationId: input.organizationId,
          restaurantId: row.id,
          currency: row.currency,
          timezone: row.timezone,
          taxInclusive: input.taxInclusive,
          kitchenSoundEnabled: input.kitchenSoundEnabled,
          inventoryPolicy: input.inventoryPolicy,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          country: input.country,
        });
        const [created] = await tx
          .select(restaurantSelect)
          .from(restaurants)
          .leftJoin(
            restaurantSettings,
            eq(restaurantSettings.restaurantId, restaurants.id),
          )
          .where(eq(restaurants.id, row.id))
          .limit(1);
        return created ?? row;
      });
    },

    async listRestaurants(organizationId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(restaurantSelect)
          .from(restaurants)
          .leftJoin(
            restaurantSettings,
            eq(restaurantSettings.restaurantId, restaurants.id),
          )
          .where(eq(restaurants.organizationId, organizationId)),
      );
    },

    async findRestaurant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(restaurantSelect)
          .from(restaurants)
          .leftJoin(
            restaurantSettings,
            eq(restaurantSettings.restaurantId, restaurants.id),
          )
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
      patch: { name?: string } & RestaurantSettingsPatch,
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const restaurantPatch: { name?: string; currency?: string; timezone?: string } =
          {};
        if (patch.name !== undefined) {
          restaurantPatch.name = patch.name;
        }
        if (patch.currency !== undefined) {
          restaurantPatch.currency = patch.currency;
        }
        if (patch.timezone !== undefined) {
          restaurantPatch.timezone = patch.timezone;
        }
        if (Object.keys(restaurantPatch).length > 0) {
          const [updated] = await tx
            .update(restaurants)
            .set(restaurantPatch)
            .where(
              and(eq(restaurants.id, id), eq(restaurants.organizationId, organizationId)),
            )
            .returning({ id: restaurants.id });
          if (!updated) {
            return null;
          }
        } else {
          const [existing] = await tx
            .select({ id: restaurants.id })
            .from(restaurants)
            .where(
              and(eq(restaurants.id, id), eq(restaurants.organizationId, organizationId)),
            )
            .limit(1);
          if (!existing) {
            return null;
          }
        }

        const settingsPatch: RestaurantSettingsPatch = {
          timezone: patch.timezone,
          currency: patch.currency,
          taxInclusive: patch.taxInclusive,
          kitchenSoundEnabled: patch.kitchenSoundEnabled,
          inventoryPolicy: patch.inventoryPolicy,
          addressLine1: patch.addressLine1,
          addressLine2: patch.addressLine2,
          city: patch.city,
          region: patch.region,
          postalCode: patch.postalCode,
          country: patch.country,
        };
        const hasSettingsPatch = Object.values(settingsPatch).some(
          (value) => value !== undefined,
        );
        if (hasSettingsPatch) {
          const [existingSettings] = await tx
            .select({ id: restaurantSettings.id })
            .from(restaurantSettings)
            .where(eq(restaurantSettings.restaurantId, id))
            .limit(1);
          if (existingSettings) {
            await tx
              .update(restaurantSettings)
              .set(settingsPatch)
              .where(eq(restaurantSettings.restaurantId, id));
          } else {
            await tx.insert(restaurantSettings).values({
              organizationId,
              restaurantId: id,
              ...settingsPatch,
            });
          }
        }

        const [row] = await tx
          .select(restaurantSelect)
          .from(restaurants)
          .leftJoin(
            restaurantSettings,
            eq(restaurantSettings.restaurantId, restaurants.id),
          )
          .where(
            and(eq(restaurants.id, id), eq(restaurants.organizationId, organizationId)),
          )
          .limit(1);
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
      posIdleTimeoutMinutes?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(branches)
          .values(input)
          .returning(branchSelect);
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
          .select(branchSelect)
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
          .select(branchSelect)
          .from(branches)
          .where(and(eq(branches.id, id), eq(branches.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    async updateBranch(
      organizationId: string,
      id: string,
      patch: { name?: string; posIdleTimeoutMinutes?: number },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(branches)
          .set(patch)
          .where(and(eq(branches.id, id), eq(branches.organizationId, organizationId)))
          .returning(branchSelect);
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

    async insertDiningTable(input: {
      organizationId: string;
      branchId: string;
      code: string;
      floor?: string;
      seats?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(diningTables)
          .values(input)
          .returning({
            id: diningTables.id,
            organizationId: diningTables.organizationId,
            branchId: diningTables.branchId,
            code: diningTables.code,
            floor: diningTables.floor,
            seats: diningTables.seats,
            status: diningTables.status,
          });
        if (!row) {
          throw new Error("TABLE_INSERT_FAILED");
        }
        return row;
      });
    },

    async listDiningTables(
      organizationId: string,
      branchId: string,
      allowedBranchIds: string[] | null,
    ) {
      if (allowedBranchIds && !allowedBranchIds.includes(branchId)) {
        return [];
      }
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: diningTables.id,
            organizationId: diningTables.organizationId,
            branchId: diningTables.branchId,
            code: diningTables.code,
            floor: diningTables.floor,
            seats: diningTables.seats,
            status: diningTables.status,
          })
          .from(diningTables)
          .where(
            and(
              eq(diningTables.organizationId, organizationId),
              eq(diningTables.branchId, branchId),
            ),
          ),
      );
    },

    async findDiningTable(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: diningTables.id,
            organizationId: diningTables.organizationId,
            branchId: diningTables.branchId,
            code: diningTables.code,
            floor: diningTables.floor,
            seats: diningTables.seats,
            status: diningTables.status,
          })
          .from(diningTables)
          .where(
            and(
              eq(diningTables.id, id),
              eq(diningTables.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    async updateDiningTable(
      organizationId: string,
      id: string,
      patch: { code?: string; floor?: string | null; seats?: number | null },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(diningTables)
          .set(patch)
          .where(
            and(
              eq(diningTables.id, id),
              eq(diningTables.organizationId, organizationId),
            ),
          )
          .returning({
            id: diningTables.id,
            organizationId: diningTables.organizationId,
            branchId: diningTables.branchId,
            code: diningTables.code,
            floor: diningTables.floor,
            seats: diningTables.seats,
            status: diningTables.status,
          });
        return row ?? null;
      });
    },

    async deleteDiningTable(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(diningTables)
          .where(
            and(
              eq(diningTables.id, id),
              eq(diningTables.organizationId, organizationId),
            ),
          )
          .returning({ id: diningTables.id });
        return deleted.length > 0;
      });
    },
  };
}

export type RestaurantRepository = ReturnType<typeof createRestaurantRepository>;
