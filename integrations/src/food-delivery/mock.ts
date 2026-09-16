import type { FoodDeliveryChannel, NormalizedPartnerOrder } from "@niva/types";

export class MockFoodDeliveryChannel implements FoodDeliveryChannel {
  readonly provider = "mock";

  ingestOrder(raw: unknown): NormalizedPartnerOrder {
    if (!raw || typeof raw !== "object") {
      throw new Error("INVALID_PARTNER_PAYLOAD");
    }
    const body = raw as Record<string, unknown>;
    if (typeof body.externalId !== "string" || body.externalId.trim().length === 0) {
      throw new Error("INVALID_PARTNER_PAYLOAD");
    }
    if (typeof body.branchId !== "string") {
      throw new Error("INVALID_PARTNER_PAYLOAD");
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("INVALID_PARTNER_PAYLOAD");
    }
    const items = body.items.map((item) => {
      if (!item || typeof item !== "object") {
        throw new Error("INVALID_PARTNER_PAYLOAD");
      }
      const line = item as Record<string, unknown>;
      if (typeof line.menuItemId !== "string" || typeof line.qty !== "number") {
        throw new Error("INVALID_PARTNER_PAYLOAD");
      }
      const modifierIds = Array.isArray(line.modifierIds)
        ? line.modifierIds.filter((id): id is string => typeof id === "string")
        : [];
      return { menuItemId: line.menuItemId, qty: line.qty, modifierIds };
    });
    return {
      externalId: body.externalId.trim(),
      source: "partner:mock",
      branchId: body.branchId,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      items,
    };
  }
}
