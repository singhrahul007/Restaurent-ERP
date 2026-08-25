import { AppError, isUniqueViolation } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { TenancyRepository } from "../tenancy/tenancy.repository.js";
import type { RestaurantRepository } from "./restaurants.repository.js";

function assertBranchAccess(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

export function createRestaurantService(
  restaurants: RestaurantRepository,
  tenancy: TenancyRepository,
) {
  return {
    list(tenant: TenantContext) {
      return restaurants.listRestaurants(tenant.organizationId);
    },

    async get(tenant: TenantContext, id: string) {
      const row = await restaurants.findRestaurant(tenant.organizationId, id);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    create(
      tenant: TenantContext,
      input: { name: string; currency?: string; timezone?: string },
    ) {
      return restaurants.insertRestaurant({
        organizationId: tenant.organizationId,
        ...input,
      });
    },

    async update(
      tenant: TenantContext,
      id: string,
      patch: { name?: string; currency?: string; timezone?: string },
    ) {
      const row = await restaurants.updateRestaurant(tenant.organizationId, id, patch);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async remove(tenant: TenantContext, id: string) {
      const deleted = await restaurants.deleteRestaurant(tenant.organizationId, id);
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async listBranches(tenant: TenantContext, restaurantId: string) {
      const restaurant = await restaurants.findRestaurant(
        tenant.organizationId,
        restaurantId,
      );
      if (!restaurant) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return restaurants.listBranches(
        tenant.organizationId,
        restaurantId,
        tenant.allowedBranchIds,
      );
    },

    async createBranch(tenant: TenantContext, restaurantId: string, name: string) {
      const restaurant = await restaurants.findRestaurant(
        tenant.organizationId,
        restaurantId,
      );
      if (!restaurant) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return restaurants.insertBranch({
        organizationId: tenant.organizationId,
        restaurantId,
        name,
      });
    },

    async getBranch(tenant: TenantContext, id: string) {
      const row = await restaurants.findBranch(tenant.organizationId, id);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranchAccess(tenant, row.id);
      return row;
    },

    async updateBranch(tenant: TenantContext, id: string, name: string) {
      assertBranchAccess(tenant, id);
      const row = await restaurants.updateBranch(tenant.organizationId, id, name);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async removeBranch(tenant: TenantContext, id: string) {
      assertBranchAccess(tenant, id);
      const deleted = await restaurants.deleteBranch(tenant.organizationId, id);
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async assignBranch(
      tenant: TenantContext,
      branchId: string,
      membershipId: string,
    ) {
      const branch = await restaurants.findBranch(tenant.organizationId, branchId);
      if (!branch) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const ok = await tenancy.membershipInOrganization(
        membershipId,
        tenant.organizationId,
      );
      if (!ok) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      try {
        return await tenancy.insertBranchAssignment({
          organizationId: tenant.organizationId,
          membershipId,
          branchId,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Membership already assigned", 409);
        }
        throw error;
      }
    },

    listAssignments(tenant: TenantContext, branchId: string) {
      return this.getBranch(tenant, branchId).then(() =>
        tenancy.listBranchAssignments(tenant.organizationId, branchId),
      );
    },

    async unassignBranch(
      tenant: TenantContext,
      branchId: string,
      membershipId: string,
    ) {
      await this.getBranch(tenant, branchId);
      const deleted = await tenancy.deleteBranchAssignment(
        tenant.organizationId,
        branchId,
        membershipId,
      );
      if (!deleted) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },
  };
}

export type RestaurantService = ReturnType<typeof createRestaurantService>;
