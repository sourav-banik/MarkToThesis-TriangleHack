/** Exact fractions over saved decimal number inputs; no rounded percentages or epsilon in scoring. */
export type Fraction = { numerator: bigint; denominator: bigint };
const zero = BigInt(0),
  one = BigInt(1),
  ten = BigInt(10);
function fraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === zero) throw new Error("Zero denominator.");
  return denominator < zero
    ? { numerator: -numerator, denominator: -denominator }
    : { numerator, denominator };
}
export function decimal(value: number): Fraction {
  if (!Number.isFinite(value)) throw new Error("Expected a finite decimal input.");
  const [coefficient, exponentText = "0"] = value.toString().toLowerCase().split("e");
  const exponent = Number(exponentText) - (coefficient.split(".")[1]?.length ?? 0);
  const numerator = BigInt(coefficient.replace(".", ""));
  return exponent >= 0
    ? fraction(numerator * ten ** BigInt(exponent), one)
    : fraction(numerator, ten ** BigInt(-exponent));
}
export function subtract(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}
export function compare(left: Fraction, right: Fraction): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < zero ? -1 : difference > zero ? 1 : 0;
}
export function change(
  start: number,
  end: number,
  metric: "price_return_pct" | "yield_change_bps",
): Fraction {
  const difference = subtract(decimal(end), decimal(start));
  if (metric === "yield_change_bps")
    return fraction(difference.numerator * BigInt(100), difference.denominator);
  if (start <= 0) throw new Error("Percentage returns require a strictly positive starting price.");
  const base = decimal(start);
  return fraction(
    difference.numerator * base.denominator * BigInt(100),
    difference.denominator * base.numerator,
  );
}
/** Conversion is for storage/display only, after exact comparisons. */
export function finiteNumber(value: Fraction): number {
  if (value.numerator === zero) return 0;
  const negative = value.numerator < zero;
  const numerator = (negative ? -value.numerator : value.numerator).toString();
  const shift = 20 + value.denominator.toString().length - numerator.length;
  const quotient =
    shift >= 0
      ? (BigInt(numerator) * ten ** BigInt(shift)) / value.denominator
      : BigInt(numerator) / (value.denominator * ten ** BigInt(-shift));
  const result = Number(`${negative ? "-" : ""}${quotient}e${-shift}`);
  if (!Number.isFinite(result) || result === 0)
    throw new Error("The calculated value is outside the supported finite number range.");
  return result;
}
