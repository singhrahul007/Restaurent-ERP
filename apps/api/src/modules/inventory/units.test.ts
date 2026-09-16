import { describe, expect, it } from "vitest";
import { convertExact, gcd, invertRatio, reduceRatio } from "./units.js";

describe("integer unit conversions", () => {
  it("reduces ratios with gcd and never uses floats", () => {
    expect(Number(gcd(1000n, 500n))).toBe(500);
    expect(reduceRatio(1000, 500)).toEqual({ numerator: 2, denominator: 1 });
    expect(invertRatio(1000, 1)).toEqual({ numerator: 1, denominator: 1000 });
  });

  it("converts kg to grams exactly", () => {
    expect(convertExact(2, 1000, 1)).toBe(2000);
    expect(convertExact(500, 1, 1)).toBe(500);
  });

  it("rejects non-integer results and float inputs", () => {
    expect(() => convertExact(500, 1, 1000)).toThrow(/not an integer/);
    expect(() => convertExact(1.5, 1000, 1)).toThrow(/integer/);
    expect(() => convertExact(1, 2.5, 1)).toThrow(/integer/);
  });
});
