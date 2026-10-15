import type {
  BecknOrder,
  BecknQuote,
  BecknQuoteBreakupItem,
  NormalizedPartnerOrder,
} from "@niva/types";

export interface CalculateQuoteInput {
  currency: string;
  items: Array<{
    id: string; // {menuItemId} or {menuItemId}:{variantId}
    name: string;
    qty: number;
    unitPriceMinor: number;
    taxRateBps: number;
    taxInclusive: boolean;
  }>;
  deliveryChargeMinor?: number;
  packagingChargeMinor?: number;
}

/**
 * Calculates Beckn RET11 compliant Quote with line item breakups, taxes, packaging, and delivery.
 */
export function calculateBecknQuote(input: CalculateQuoteInput): BecknQuote {
  const currency = input.currency ?? "INR";
  const breakup: BecknQuoteBreakupItem[] = [];

  let itemsSubtotalMinor = 0;
  let taxTotalMinor = 0;

  // 1. Items
  for (const item of input.items) {
    const lineGross = item.qty * item.unitPriceMinor;
    itemsSubtotalMinor += lineGross;

    const lineTax = item.taxInclusive
      ? Math.round((lineGross * item.taxRateBps) / (10_000 + item.taxRateBps))
      : Math.round((lineGross * item.taxRateBps) / 10_000);

    if (!item.taxInclusive) {
      taxTotalMinor += lineTax;
    }

    const lineTotal = ((item.taxInclusive ? lineGross : lineGross + lineTax) / 100).toFixed(2);
    const unitPrice = (item.unitPriceMinor / 100).toFixed(2);

    breakup.push({
      "@ondc/org/item_id": item.id,
      "@ondc/org/item_quantity": {
        count: item.qty,
      },
      title: item.name,
      "@ondc/org/title_type": "item",
      price: {
        currency,
        value: lineTotal,
      },
      item: {
        price: {
          currency,
          value: unitPrice,
        },
      },
    });
  }

  // 2. Packaging charges (standard for F&B on ONDC)
  const packagingMinor = input.packagingChargeMinor ?? 2000; // default 20.00
  if (packagingMinor > 0) {
    const packingVal = (packagingMinor / 100).toFixed(2);
    breakup.push({
      "@ondc/org/item_id": "F1",
      title: "Packing charges",
      "@ondc/org/title_type": "packing",
      price: {
        currency,
        value: packingVal,
      },
    });
  }

  // 3. Delivery charges
  const deliveryMinor = input.deliveryChargeMinor ?? 0;
  if (deliveryMinor > 0) {
    const delVal = (deliveryMinor / 100).toFixed(2);
    breakup.push({
      "@ondc/org/item_id": "F1",
      title: "Delivery charges",
      "@ondc/org/title_type": "delivery",
      price: {
        currency,
        value: delVal,
      },
    });
  }

  // 4. Tax summary if exclusive
  if (taxTotalMinor > 0) {
    const taxVal = (taxTotalMinor / 100).toFixed(2);
    breakup.push({
      "@ondc/org/item_id": "F1",
      title: "Tax",
      "@ondc/org/title_type": "tax",
      price: {
        currency,
        value: taxVal,
      },
    });
  }

  const grandTotalMinor = itemsSubtotalMinor + taxTotalMinor + packagingMinor + deliveryMinor;
  const grandTotalVal = (grandTotalMinor / 100).toFixed(2);

  return {
    price: {
      currency,
      value: grandTotalVal,
    },
    breakup,
    ttl: "P1D",
  };
}

/**
 * Converts Beckn confirmed order payload into Niva NormalizedPartnerOrder format
 */
export function normalizeBecknOrder(
  branchId: string,
  becknOrder: BecknOrder,
): NormalizedPartnerOrder {
  const items = becknOrder.items.map((it) => {
    // ID can be menuItemId or menuItemId:variantId
    const [menuItemId] = it.id.split(":");
    return {
      menuItemId: menuItemId!,
      qty: it.quantity.count,
      modifierIds: [],
    };
  });

  return {
    externalId: becknOrder.id ?? `ONDC-${Date.now()}`,
    source: "partner:ondc",
    branchId,
    notes: `Customer: ${becknOrder.billing?.name ?? "ONDC Customer"}, Phone: ${becknOrder.billing?.phone ?? "N/A"}`,
    items,
  };
}
