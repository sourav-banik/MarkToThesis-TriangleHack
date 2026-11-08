import { describe, expect, it } from "vitest";
import { change, compare, decimal, finiteNumber, subtract } from "./arithmetic";

describe("exact scoring arithmetic", () => {
  it("treats decimal yield moves as exact basis points at inclusive boundaries", () => {
    expect(compare(change(4, 4.1, "yield_change_bps"), decimal(10))).toBe(0);
    expect(finiteNumber(change(4, 4.05, "yield_change_bps"))).toBe(5);
  });
  it("recognizes equal returns from differently scaled decimal prices", () => {
    expect(
      compare(change(0.1, 0.11, "price_return_pct"), change(100, 110, "price_return_pct")),
    ).toBe(0);
  });
  it("keeps a small but real excess return instead of rounding it to a tie", () => {
    const relative = subtract(
      change(100, 100.000000001, "price_return_pct"),
      change(100, 100, "price_return_pct"),
    );
    expect(compare(relative, decimal(0))).toBe(1);
    expect(finiteNumber(relative)).toBe(1e-9);
  });
  it("converts very large fraction operands without Infinity/Infinity", () => {
    expect(finiteNumber(change(1e-300, 2e-300, "price_return_pct"))).toBe(100);
    expect(finiteNumber(subtract(decimal(1e300), decimal(5e299)))).toBe(5e299);
  });
  it("reports unsupported output magnitudes and nonpositive denominators", () => {
    expect(() => finiteNumber(change(1e-300, 1e300, "price_return_pct"))).toThrow(
      "finite number range",
    );
    expect(() => change(0, 10, "price_return_pct")).toThrow("positive starting price");
    expect(() => change(-1, 10, "price_return_pct")).toThrow("positive starting price");
  });
});
