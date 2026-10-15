import { describe, expect, it } from "vitest";
import { calculateBecknQuote, normalizeBecknOrder } from "./orders.js";

describe("ONDC Order and Quotation Helpers", () => {
  it("calculates accurate Beckn Quote with item breakups, packaging, and taxes", () => {
    const quote = calculateBecknQuote({
      currency: "INR",
      items: [
        {
          id: "item-1",
          name: "Butter Chicken",
          qty: 2,
          unitPriceMinor: 35000, // 350.00
          taxRateBps: 500, // 5%
          taxInclusive: false,
        },
      ],
      packagingChargeMinor: 2500, // 25.00
      deliveryChargeMinor: 5000, // 50.00
    });

    // 2 * 350 = 700.00
    // Tax = 5% of 700 = 35.00
    // Packing = 25.00
    // Delivery = 50.00
    // Total = 700 + 35 + 25 + 50 = 810.00
    expect(quote.price.value).toBe("810.00");
    expect(quote.breakup.length).toBe(4);
    expect(quote.breakup[0]?.title).toBe("Butter Chicken");
    expect(quote.breakup[1]?.title).toBe("Packing charges");
    expect(quote.breakup[2]?.title).toBe("Delivery charges");
    expect(quote.breakup[3]?.title).toBe("Tax");
  });

  it("normalizes Beckn order to Niva partner order structure", () => {
    const normalized = normalizeBecknOrder("branch-001", {
      id: "ONDC-ORDER-999",
      billing: {
        name: "Rahul Sharma",
        phone: "+919876543210",
      },
      items: [
        {
          id: "item-001:variant-large",
          quantity: { count: 2 },
        },
        {
          id: "item-002",
          quantity: { count: 1 },
        },
      ],
    });

    expect(normalized.externalId).toBe("ONDC-ORDER-999");
    expect(normalized.source).toBe("partner:ondc");
    expect(normalized.branchId).toBe("branch-001");
    expect(normalized.items.length).toBe(2);
    expect(normalized.items[0]?.menuItemId).toBe("item-001");
    expect(normalized.items[0]?.qty).toBe(2);
    expect(normalized.items[1]?.menuItemId).toBe("item-002");
    expect(normalized.items[1]?.qty).toBe(1);
    expect(normalized.notes).toContain("Rahul Sharma");
  });
});
