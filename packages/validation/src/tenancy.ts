import { z } from "zod";

export const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const patchOrganizationBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const createRestaurantBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  taxInclusive: z.boolean().optional(),
  inventoryPolicy: z.enum(["OFF", "ON_SALE", "MANUAL"]).optional(),
  kitchenSoundEnabled: z.boolean().optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
});

export const patchRestaurantBodySchema = createRestaurantBodySchema.partial();

export const createBranchBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  posIdleTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
});

export const patchBranchBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  posIdleTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
});

export const assignBranchBodySchema = z.object({
  membershipId: z.string().uuid(),
});

export const createDiningTableBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
  floor: z.string().trim().max(64).optional(),
  seats: z.number().int().min(1).max(99).optional(),
});

export const patchDiningTableBodySchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  floor: z.string().trim().max(64).nullable().optional(),
  seats: z.number().int().min(1).max(99).nullable().optional(),
});

export const inviteStaffBodySchema = z.object({
  email: z.string().trim().email().max(320).toLowerCase(),
  roleSlug: z.string().trim().min(1).max(64),
  branchIds: z.array(z.string().uuid()).default([]),
});

export const patchStaffBodySchema = z.object({
  roleSlug: z.string().trim().min(1).max(64).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
});

export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
export type CreateRestaurantBody = z.infer<typeof createRestaurantBodySchema>;
export type PatchRestaurantBody = z.infer<typeof patchRestaurantBodySchema>;
export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;
export type PatchBranchBody = z.infer<typeof patchBranchBodySchema>;
export type AssignBranchBody = z.infer<typeof assignBranchBodySchema>;
export type CreateDiningTableBody = z.infer<typeof createDiningTableBodySchema>;
export type PatchDiningTableBody = z.infer<typeof patchDiningTableBodySchema>;
export type InviteStaffBody = z.infer<typeof inviteStaffBodySchema>;
export type PatchStaffBody = z.infer<typeof patchStaffBodySchema>;
