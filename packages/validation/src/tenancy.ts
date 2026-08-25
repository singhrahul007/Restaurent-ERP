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
});

export const patchRestaurantBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export const createBranchBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const patchBranchBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const assignBranchBodySchema = z.object({
  membershipId: z.string().uuid(),
});

export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
export type CreateRestaurantBody = z.infer<typeof createRestaurantBodySchema>;
export type PatchRestaurantBody = z.infer<typeof patchRestaurantBodySchema>;
export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;
export type PatchBranchBody = z.infer<typeof patchBranchBodySchema>;
export type AssignBranchBody = z.infer<typeof assignBranchBodySchema>;
