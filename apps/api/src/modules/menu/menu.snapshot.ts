export type SnapshotItem = {
  id: string;
  name: string;
  basePriceMinor: number;
};

export type SnapshotVariant = {
  id: string;
  name: string;
  priceDeltaMinor: number;
};

export type SnapshotModifier = {
  id: string;
  name: string;
  priceDeltaMinor: number;
};

export type FrozenModifier = {
  modifierId: string;
  name: string;
  priceDeltaMinor: number;
};

export type FrozenMenuLine = {
  itemId: string;
  itemName: string;
  variantId: string | null;
  variantName: string | null;
  modifiers: FrozenModifier[];
  basePriceMinor: number;
  variantPriceDeltaMinor: number;
  modifiersPriceDeltaMinor: number;
  unitPriceMinor: number;
};

function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

/**
 * Freeze live menu names and integer prices for an order line.
 * Callers persist the returned snapshot; later catalog edits must not mutate it.
 */
export function freezeMenuLine(input: {
  item: SnapshotItem;
  variant?: SnapshotVariant | null;
  modifiers?: SnapshotModifier[];
}): FrozenMenuLine {
  const basePriceMinor = assertInteger(input.item.basePriceMinor, "basePriceMinor");
  const variantPriceDeltaMinor = input.variant
    ? assertInteger(input.variant.priceDeltaMinor, "variant.priceDeltaMinor")
    : 0;
  const modifiers = (input.modifiers ?? []).map((modifier) => ({
    modifierId: modifier.id,
    name: modifier.name,
    priceDeltaMinor: assertInteger(modifier.priceDeltaMinor, "modifier.priceDeltaMinor"),
  }));
  const modifiersPriceDeltaMinor = modifiers.reduce(
    (sum, modifier) => sum + modifier.priceDeltaMinor,
    0,
  );
  return {
    itemId: input.item.id,
    itemName: input.item.name,
    variantId: input.variant?.id ?? null,
    variantName: input.variant?.name ?? null,
    modifiers,
    basePriceMinor,
    variantPriceDeltaMinor,
    modifiersPriceDeltaMinor,
    unitPriceMinor: basePriceMinor + variantPriceDeltaMinor + modifiersPriceDeltaMinor,
  };
}

export type ModifierGroupSelection = {
  id: string;
  minSelect: number;
  maxSelect: number;
  modifierIds: string[];
};

export function assertModifierSelection(
  groups: ModifierGroupSelection[],
  selectedModifierIds: string[],
): void {
  const selected = new Set(selectedModifierIds);
  for (const group of groups) {
    const count = group.modifierIds.filter((id) => selected.has(id)).length;
    if (count < group.minSelect || count > group.maxSelect) {
      throw new Error("MODIFIER_SELECTION_INVALID");
    }
  }
}
