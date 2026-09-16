export type NormalizedPartnerLine = {
  menuItemId: string;
  qty: number;
  modifierIds: string[];
};

export type NormalizedPartnerOrder = {
  externalId: string;
  source: `partner:${string}`;
  branchId: string;
  notes?: string;
  items: NormalizedPartnerLine[];
};

export type FoodDeliveryChannel = {
  provider: string;
  ingestOrder(raw: unknown): NormalizedPartnerOrder;
};
