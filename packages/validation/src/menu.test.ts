import { describe, expect, it } from "vitest";
import {
  createMenuItemBodySchema,
  createModifierGroupBodySchema,
  createTaxClassBodySchema,
  createVariantBodySchema,
} from "./menu.js";

describe("menu validation", () => {
  it("accepts GST rates in integer basis points", () => {
    const parsed = createTaxClassBodySchema.parse({
      name: "GST 18",
      rateBps: 1800,
      cgstBps: 900,
      sgstBps: 900,
      igstBps: 0,
    });
    expect(parsed.rateBps).toBe(1800);
  });

  it("rejects GST components that do not sum to rateBps", () => {
    const parsed = createTaxClassBodySchema.safeParse({
      name: "GST",
      rateBps: 1800,
      cgstBps: 900,
      sgstBps: 900,
      igstBps: 1800,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects float money and float tax rates", () => {
    expect(
      createMenuItemBodySchema.safeParse({
        name: "Dosa",
        categoryId: "11111111-1111-1111-1111-111111111111",
        taxClassId: "11111111-1111-4111-8111-111111111111",
        basePriceMinor: 10.5,
      }).success,
    ).toBe(false);
    expect(
      createVariantBodySchema.safeParse({
        name: "Large",
        priceDeltaMinor: 1.25,
      }).success,
    ).toBe(false);
    expect(
      createTaxClassBodySchema.safeParse({
        name: "GST",
        rateBps: 18.0,
      }).success,
    ).toBe(true);
    expect(
      createTaxClassBodySchema.safeParse({
        name: "GST",
        rateBps: 18.5,
      }).success,
    ).toBe(false);
  });

  it("rejects modifier groups where maxSelect is below minSelect", () => {
    expect(
      createModifierGroupBodySchema.safeParse({
        name: "Add-ons",
        minSelect: 2,
        maxSelect: 1,
      }).success,
    ).toBe(false);
  });
});
