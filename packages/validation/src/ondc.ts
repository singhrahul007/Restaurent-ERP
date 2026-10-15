import { z } from "zod";

export const becknContextSchema = z.object({
  domain: z.string().min(1),
  country: z.string().min(2),
  city: z.string().min(1),
  action: z.enum([
    "search",
    "on_search",
    "select",
    "on_select",
    "init",
    "on_init",
    "confirm",
    "on_confirm",
    "status",
    "on_status",
    "track",
    "on_track",
    "cancel",
    "on_cancel",
    "update",
    "on_update",
  ]),
  core_version: z.string().min(1),
  bap_id: z.string().min(1),
  bap_uri: z.string().url(),
  bpp_id: z.string().optional(),
  bpp_uri: z.string().url().optional(),
  transaction_id: z.string().min(1),
  message_id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }).or(z.string().min(10)),
  key: z.string().optional(),
  ttl: z.string().optional(),
});

export const becknAckResponseSchema = z.object({
  message: z.object({
    ack: z.object({
      status: z.enum(["ACK", "NACK"]),
    }),
  }),
  error: z
    .object({
      type: z
        .enum(["CONTEXT-ERROR", "CORE-ERROR", "DOMAIN-ERROR", "POLICY-ERROR", "JSON-SCHEMA-ERROR"])
        .optional(),
      code: z.string(),
      path: z.string().optional(),
      message: z.string(),
    })
    .optional(),
});

export const ondcSellerConfigSchema = z.object({
  subscriberId: z.string().min(1),
  subscriberUrl: z.string().url(),
  uniqueKeyId: z.string().min(1),
  signingPrivateKey: z.string().min(1),
  signingPublicKey: z.string().min(1),
  encryptionPrivateKey: z.string().optional(),
  encryptionPublicKey: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
  enabled: z.boolean().default(true),
  autoAcceptOrders: z.boolean().default(true),
  defaultPreparationTimeMinutes: z.number().int().min(1).max(180).default(30),
});

export const becknProtocolBodySchema = z.object({
  context: becknContextSchema,
  message: z.record(z.string(), z.unknown()).optional(),
});

export type BecknContextSchema = z.infer<typeof becknContextSchema>;
export type BecknAckResponseSchema = z.infer<typeof becknAckResponseSchema>;
export type OndcSellerConfig = z.infer<typeof ondcSellerConfigSchema>;
export type BecknProtocolBody = z.infer<typeof becknProtocolBodySchema>;

