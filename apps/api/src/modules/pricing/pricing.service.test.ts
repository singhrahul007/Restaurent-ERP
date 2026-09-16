import { describe, expect, it } from "vitest";
import {
  allocateInteger,
  integerMulDiv,
  priceOrder,
  roundToUnit,
} from "./pricing.service.js";

describe("integer money helpers", () => {
  it("multiplies and divides with half-up rounding and no floats", () => {
    expect(integerMulDiv(10000, 1800, 10_000)).toBe(1800);
    expect(integerMulDiv(199, 1, 2)).toBe(100);
    expect(() => integerMulDiv(10.5, 1, 1)).toThrow(/integer/);
  });

  it("allocates remainders so parts sum to the amount", () => {
    expect(allocateInteger(100, [1, 1, 1]).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(allocateInteger(5, [2, 2])).toEqual([3, 2]);
  });

  it("rounds to the nearest rupee (100 paise)", () => {
    expect(roundToUnit(150, 100)).toBe(200);
    expect(roundToUnit(149, 100)).toBe(100);
  });
});

describe("priceOrder", () => {
  it("prices exclusive GST, qty, modifiers already in unit price, and service charge", () => {
    const priced = priceOrder({
      lines: [
        { qty: 2, unitPriceMinor: 13500, taxRateBps: 1800, taxInclusive: false },
      ],
      serviceChargeBps: 500,
    });
    expect(priced.subtotalMinor).toBe(27000);
    expect(priced.taxTotalMinor).toBe(4860);
    expect(priced.serviceChargeMinor).toBe(1350);
    expect(priced.totalMinor).toBe(27000 + 4860 + 1350);
    expect(priced.lines[0]?.lineTotalMinor).toBe(27000 + 4860);
  });

  it("extracts inclusive tax from the selling price", () => {
    const priced = priceOrder({
      lines: [{ qty: 1, unitPriceMinor: 11800, taxRateBps: 1800, taxInclusive: true }],
    });
    expect(priced.taxTotalMinor).toBe(1800);
    expect(priced.totalMinor).toBe(11800);
  });

  it("applies percent and amount discounts without going negative", () => {
    const percent = priceOrder({
      lines: [{ qty: 1, unitPriceMinor: 10000, taxRateBps: 0, taxInclusive: false }],
      orderDiscount: { type: "PERCENT", percentBps: 1000 },
    });
    expect(percent.discountTotalMinor).toBe(1000);
    expect(percent.totalMinor).toBe(9000);

    const capped = priceOrder({
      lines: [{ qty: 1, unitPriceMinor: 500, taxRateBps: 0, taxInclusive: false }],
      orderDiscount: { type: "AMOUNT", amountMinor: 800 },
    });
    expect(capped.discountTotalMinor).toBe(500);
    expect(capped.totalMinor).toBe(0);
  });

  it("applies a coupon stub after discounts", () => {
    const priced = priceOrder({
      lines: [{ qty: 1, unitPriceMinor: 10000, taxRateBps: 0, taxInclusive: false }],
      orderDiscount: { type: "AMOUNT", amountMinor: 1000 },
      couponAmountMinor: 2000,
    });
    expect(priced.discountTotalMinor).toBe(1000);
    expect(priced.couponTotalMinor).toBe(2000);
    expect(priced.totalMinor).toBe(7000);
  });

  it("stores rounding as an integer delta to the nearest rupee", () => {
    const priced = priceOrder({
      lines: [{ qty: 1, unitPriceMinor: 149, taxRateBps: 0, taxInclusive: false }],
      roundingUnitMinor: 100,
    });
    expect(priced.totalMinor).toBe(100);
    expect(priced.roundingMinor).toBe(-49);
  });

  it("rejects float money", () => {
    expect(() =>
      priceOrder({
        lines: [{ qty: 1, unitPriceMinor: 10.25, taxRateBps: 0, taxInclusive: false }],
      }),
    ).toThrow(/integer/);
  });
});
