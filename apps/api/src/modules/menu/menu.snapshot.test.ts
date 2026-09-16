import { describe, expect, it } from "vitest";
import { assertModifierSelection, freezeMenuLine } from "./menu.snapshot.js";

describe("freezeMenuLine", () => {
  it("keeps frozen names and integer prices after the live catalog changes", () => {
    const live = {
      item: { id: "item-1", name: "Masala dosa", basePriceMinor: 12000 },
      variant: { id: "var-1", name: "Regular", priceDeltaMinor: 0 },
      modifiers: [{ id: "mod-1", name: "Extra chutney", priceDeltaMinor: 1500 }],
    };

    const frozen = freezeMenuLine(live);

    live.item.basePriceMinor = 15000;
    live.item.name = "Paper dosa";
    live.variant.priceDeltaMinor = 2000;
    live.modifiers[0]!.priceDeltaMinor = 2500;
    live.modifiers[0]!.name = "Gunpowder";

    expect(frozen.itemName).toBe("Masala dosa");
    expect(frozen.basePriceMinor).toBe(12000);
    expect(frozen.variantPriceDeltaMinor).toBe(0);
    expect(frozen.modifiers[0]?.name).toBe("Extra chutney");
    expect(frozen.modifiers[0]?.priceDeltaMinor).toBe(1500);
    expect(frozen.unitPriceMinor).toBe(13500);

    const liveAgain = freezeMenuLine(live);
    expect(liveAgain.unitPriceMinor).not.toBe(frozen.unitPriceMinor);
    expect(liveAgain.itemName).not.toBe(frozen.itemName);
  });

  it("rejects float prices", () => {
    expect(() =>
      freezeMenuLine({
        item: { id: "item-1", name: "Tea", basePriceMinor: 10.5 },
      }),
    ).toThrow(/integer/);
  });
});

describe("assertModifierSelection", () => {
  const group = {
    id: "g1",
    minSelect: 1,
    maxSelect: 2,
    modifierIds: ["a", "b", "c"],
  };

  it("accepts a count within min/max", () => {
    expect(() => assertModifierSelection([group], ["a"])).not.toThrow();
    expect(() => assertModifierSelection([group], ["a", "b"])).not.toThrow();
  });

  it("rejects below min or above max", () => {
    expect(() => assertModifierSelection([group], [])).toThrow("MODIFIER_SELECTION_INVALID");
    expect(() => assertModifierSelection([group], ["a", "b", "c"])).toThrow(
      "MODIFIER_SELECTION_INVALID",
    );
  });
});
