import { z } from "zod";

export const upsertIntegrationAccountBodySchema = z.object({
  provider: z.string().trim().min(1).max(64),
  label: z.string().trim().max(120).optional(),
  credentials: z.record(z.string(), z.string().min(1)).refine((value) => Object.keys(value).length > 0, {
    message: "credentials required",
  }),
  enabled: z.boolean().optional(),
});

export const ingestPartnerOrderBodySchema = z.object({
  externalId: z.string().trim().min(1).max(128),
  branchId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        qty: z.number().int().min(1).max(99),
        modifierIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .min(1),
});

export type UpsertIntegrationAccountBody = z.infer<typeof upsertIntegrationAccountBodySchema>;
export type IngestPartnerOrderBody = z.infer<typeof ingestPartnerOrderBodySchema>;
