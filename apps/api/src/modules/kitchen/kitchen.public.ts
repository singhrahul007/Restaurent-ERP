export type PublicKitchenItem = {
  id: string;
  name: string;
  variantName: string | null;
  qty: number;
  modifiers: string[];
  status: string;
};

export type PublicKitchenTicket = {
  id: string;
  orderId: string;
  branchId: string;
  status: string;
  orderType: string;
  tableCode: string | null;
  createdAt: Date;
  items: PublicKitchenItem[];
};

const MONEY_KEYS = /payment|amountminor|totalminor|balanceminor|unitprice|subtotal|coupon|tax/i;

export function parseModifierNames(modifiersJson: string): string[] {
  try {
    const parsed = JSON.parse(modifiersJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function toPublicKitchenTicket(
  ticket: {
    id: string;
    orderId: string;
    branchId: string;
    status: string;
    orderType: string;
    tableCode: string | null;
    createdAt: Date;
  },
  items: Array<{
    id: string;
    ticketId: string;
    name: string;
    variantName: string | null;
    qty: number;
    modifiersJson: string;
    status: string;
  }>,
): PublicKitchenTicket {
  return {
    id: ticket.id,
    orderId: ticket.orderId,
    branchId: ticket.branchId,
    status: ticket.status,
    orderType: ticket.orderType,
    tableCode: ticket.tableCode,
    createdAt: ticket.createdAt,
    items: items
      .filter((item) => item.ticketId === ticket.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        variantName: item.variantName,
        qty: item.qty,
        modifiers: parseModifierNames(item.modifiersJson),
        status: item.status,
      })),
  };
}

export function kitchenPayloadHasMoney(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(kitchenPayloadHasMoney);
  }
  for (const [key, nested] of Object.entries(value)) {
    if (MONEY_KEYS.test(key)) {
      return true;
    }
    if (kitchenPayloadHasMoney(nested)) {
      return true;
    }
  }
  return false;
}
