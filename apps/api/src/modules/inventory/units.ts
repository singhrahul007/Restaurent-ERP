/** Integer-only unit conversions. qty_to = qty_from * numerator / denominator, exact. */

function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

export function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

export function reduceRatio(
  numerator: number,
  denominator: number,
): { numerator: number; denominator: number } {
  assertInteger(numerator, "numerator");
  assertInteger(denominator, "denominator");
  if (numerator <= 0 || denominator <= 0) {
    throw new Error("ratio parts must be positive integers");
  }
  const divisor = gcd(BigInt(numerator), BigInt(denominator));
  return {
    numerator: Number(BigInt(numerator) / divisor),
    denominator: Number(BigInt(denominator) / divisor),
  };
}

export function invertRatio(numerator: number, denominator: number): {
  numerator: number;
  denominator: number;
} {
  return reduceRatio(denominator, numerator);
}

/**
 * Convert `qty` using an integer ratio. Throws if the result is not an integer
 * (no rounding, no floats).
 */
export function convertExact(qty: number, numerator: number, denominator: number): number {
  assertInteger(qty, "qty");
  assertInteger(numerator, "numerator");
  assertInteger(denominator, "denominator");
  if (denominator <= 0 || numerator <= 0) {
    throw new Error("ratio parts must be positive integers");
  }
  const product = BigInt(qty) * BigInt(numerator);
  const den = BigInt(denominator);
  if (product % den !== 0n) {
    throw new Error("conversion is not an integer quantity");
  }
  const result = product / den;
  const asNumber = Number(result);
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error("integer overflow");
  }
  return asNumber;
}
