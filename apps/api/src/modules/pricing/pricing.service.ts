function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

/** Round-half-up (a * numerator) / denominator using BigInt only. */
export function integerMulDiv(amount: number, numerator: number, denominator: number): number {
  assertInteger(amount, "amount");
  assertInteger(numerator, "numerator");
  assertInteger(denominator, "denominator");
  if (denominator <= 0) {
    throw new Error("denominator must be a positive integer");
  }
  const value =
    (BigInt(amount) * BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator);
  const asNumber = Number(value);
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error("integer overflow");
  }
  return asNumber;
}

export function roundToUnit(amountMinor: number, unitMinor: number): number {
  assertInteger(amountMinor, "amountMinor");
  assertInteger(unitMinor, "unitMinor");
  if (unitMinor <= 0) {
    throw new Error("unitMinor must be a positive integer");
  }
  return integerMulDiv(amountMinor, 1, unitMinor) * unitMinor;
}

/** Largest-remainder allocation so parts sum exactly to `amount`. */
export function allocateInteger(amount: number, weights: number[]): number[] {
  assertInteger(amount, "amount");
  if (amount < 0) {
    throw new Error("amount must be >= 0");
  }
  const totalWeight = weights.reduce((sum, weight) => {
    assertInteger(weight, "weight");
    return sum + weight;
  }, 0);
  if (amount === 0 || totalWeight <= 0) {
    return weights.map(() => 0);
  }
  const raw = weights.map((weight) => (BigInt(amount) * BigInt(weight)) / BigInt(totalWeight));
  const assigned = raw.reduce((sum, value) => sum + value, 0n);
  const remainder = BigInt(amount) - assigned;
  const fractions = weights.map((weight, index) => ({
    index,
    frac: (BigInt(amount) * BigInt(weight)) % BigInt(totalWeight),
  }));
  fractions.sort((a, b) => {
    if (a.frac === b.frac) {
      return a.index - b.index;
    }
    return a.frac > b.frac ? -1 : 1;
  });
  const parts = raw.map((value) => Number(value));
  for (let i = 0; i < Number(remainder); i += 1) {
    const target = fractions[i];
    if (target) {
      parts[target.index] = (parts[target.index] ?? 0) + 1;
    }
  }
  return parts;
}

export type PricedLineInput = {
  qty: number;
  unitPriceMinor: number;
  taxRateBps: number;
  taxInclusive: boolean;
  lineDiscountMinor?: number;
};

export type OrderDiscountInput =
  | { type: "PERCENT"; percentBps: number }
  | { type: "AMOUNT"; amountMinor: number };

export type PriceOrderInput = {
  lines: PricedLineInput[];
  orderDiscount?: OrderDiscountInput;
  /** Coupon stub: integer amount already resolved from a coupon. */
  couponAmountMinor?: number;
  serviceChargeBps?: number;
  /** Round payable to this unit (100 = nearest rupee). 0/undefined = none. */
  roundingUnitMinor?: number;
};

export type PricedLine = {
  qty: number;
  unitPriceMinor: number;
  lineGrossMinor: number;
  lineDiscountMinor: number;
  allocatedOrderDiscountMinor: number;
  allocatedCouponMinor: number;
  taxableMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
};

export type PriceOrderResult = {
  lines: PricedLine[];
  subtotalMinor: number;
  discountTotalMinor: number;
  couponTotalMinor: number;
  taxTotalMinor: number;
  serviceChargeMinor: number;
  roundingMinor: number;
  totalMinor: number;
};

function taxOn(taxableMinor: number, rateBps: number, inclusive: boolean): number {
  if (rateBps === 0 || taxableMinor === 0) {
    return 0;
  }
  if (inclusive) {
    return integerMulDiv(taxableMinor, rateBps, 10_000 + rateBps);
  }
  return integerMulDiv(taxableMinor, rateBps, 10_000);
}

export function priceOrder(input: PriceOrderInput): PriceOrderResult {
  const lines = input.lines.map((line, index) => {
    assertInteger(line.qty, `lines[${index}].qty`);
    assertInteger(line.unitPriceMinor, `lines[${index}].unitPriceMinor`);
    assertInteger(line.taxRateBps, `lines[${index}].taxRateBps`);
    if (line.qty <= 0) {
      throw new Error(`lines[${index}].qty must be >= 1`);
    }
    if (line.unitPriceMinor < 0) {
      throw new Error(`lines[${index}].unitPriceMinor must be >= 0`);
    }
    if (line.taxRateBps < 0) {
      throw new Error(`lines[${index}].taxRateBps must be >= 0`);
    }
    const lineGrossMinor = line.qty * line.unitPriceMinor;
    const lineDiscountMinor = Math.min(
      lineGrossMinor,
      line.lineDiscountMinor ?? 0,
    );
    if (line.lineDiscountMinor !== undefined) {
      assertInteger(line.lineDiscountMinor, `lines[${index}].lineDiscountMinor`);
      if (line.lineDiscountMinor < 0) {
        throw new Error(`lines[${index}].lineDiscountMinor must be >= 0`);
      }
    }
    return {
      qty: line.qty,
      unitPriceMinor: line.unitPriceMinor,
      taxRateBps: line.taxRateBps,
      taxInclusive: line.taxInclusive,
      lineGrossMinor,
      lineDiscountMinor,
      afterLineDiscountMinor: lineGrossMinor - lineDiscountMinor,
    };
  });

  const afterLineDiscounts = lines.map((line) => line.afterLineDiscountMinor);
  const afterLineTotal = afterLineDiscounts.reduce((sum, value) => sum + value, 0);

  let orderDiscountMinor = 0;
  if (input.orderDiscount?.type === "PERCENT") {
    assertInteger(input.orderDiscount.percentBps, "orderDiscount.percentBps");
    if (input.orderDiscount.percentBps < 0 || input.orderDiscount.percentBps > 10_000) {
      throw new Error("orderDiscount.percentBps must be 0–10000");
    }
    orderDiscountMinor = integerMulDiv(afterLineTotal, input.orderDiscount.percentBps, 10_000);
  } else if (input.orderDiscount?.type === "AMOUNT") {
    assertInteger(input.orderDiscount.amountMinor, "orderDiscount.amountMinor");
    if (input.orderDiscount.amountMinor < 0) {
      throw new Error("orderDiscount.amountMinor must be >= 0");
    }
    orderDiscountMinor = Math.min(afterLineTotal, input.orderDiscount.amountMinor);
  }

  const allocatedOrderDiscount = allocateInteger(orderDiscountMinor, afterLineDiscounts);
  const afterOrder = afterLineDiscounts.map(
    (value, index) => value - (allocatedOrderDiscount[index] ?? 0),
  );
  const afterOrderTotal = afterOrder.reduce((sum, value) => sum + value, 0);

  const couponAmountMinor = input.couponAmountMinor ?? 0;
  if (input.couponAmountMinor !== undefined) {
    assertInteger(input.couponAmountMinor, "couponAmountMinor");
    if (input.couponAmountMinor < 0) {
      throw new Error("couponAmountMinor must be >= 0");
    }
  }
  const couponTotalMinor = Math.min(afterOrderTotal, couponAmountMinor);
  const allocatedCoupon = allocateInteger(couponTotalMinor, afterOrder);

  const pricedLines: PricedLine[] = lines.map((line, index) => {
    const allocatedOrderDiscountMinor = allocatedOrderDiscount[index] ?? 0;
    const allocatedCouponMinor = allocatedCoupon[index] ?? 0;
    const taxableMinor = Math.max(
      0,
      line.afterLineDiscountMinor - allocatedOrderDiscountMinor - allocatedCouponMinor,
    );
    const taxMinor = taxOn(taxableMinor, line.taxRateBps, line.taxInclusive);
    const lineTotalMinor = line.taxInclusive ? taxableMinor : taxableMinor + taxMinor;
    return {
      qty: line.qty,
      unitPriceMinor: line.unitPriceMinor,
      lineGrossMinor: line.lineGrossMinor,
      lineDiscountMinor: line.lineDiscountMinor,
      allocatedOrderDiscountMinor,
      allocatedCouponMinor,
      taxableMinor,
      taxMinor,
      lineTotalMinor,
    };
  });

  const subtotalMinor = pricedLines.reduce((sum, line) => sum + line.lineGrossMinor, 0);
  const lineDiscountTotal = pricedLines.reduce((sum, line) => sum + line.lineDiscountMinor, 0);
  const discountTotalMinor = lineDiscountTotal + orderDiscountMinor;
  const taxTotalMinor = pricedLines.reduce((sum, line) => sum + line.taxMinor, 0);
  const exclusiveTax = pricedLines.reduce(
    (sum, line, index) => sum + (lines[index]?.taxInclusive ? 0 : line.taxMinor),
    0,
  );

  const serviceChargeBps = input.serviceChargeBps ?? 0;
  if (input.serviceChargeBps !== undefined) {
    assertInteger(input.serviceChargeBps, "serviceChargeBps");
    if (input.serviceChargeBps < 0) {
      throw new Error("serviceChargeBps must be >= 0");
    }
  }
  const serviceBase = afterOrderTotal - couponTotalMinor;
  const serviceChargeMinor = integerMulDiv(serviceBase, serviceChargeBps, 10_000);

  const preRound =
    subtotalMinor - discountTotalMinor - couponTotalMinor + exclusiveTax + serviceChargeMinor;
  const roundingUnitMinor = input.roundingUnitMinor ?? 0;
  if (input.roundingUnitMinor !== undefined) {
    assertInteger(input.roundingUnitMinor, "roundingUnitMinor");
    if (input.roundingUnitMinor < 0) {
      throw new Error("roundingUnitMinor must be >= 0");
    }
  }
  const totalMinor =
    roundingUnitMinor > 0 ? roundToUnit(preRound, roundingUnitMinor) : preRound;
  const roundingMinor = totalMinor - preRound;

  return {
    lines: pricedLines,
    subtotalMinor,
    discountTotalMinor,
    couponTotalMinor,
    taxTotalMinor,
    serviceChargeMinor,
    roundingMinor,
    totalMinor,
  };
}
