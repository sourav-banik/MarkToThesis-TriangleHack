import { describe, expect, it } from "vitest";
import { confidenceMatchesQuote } from "./confidence";

describe("author confidence expressions", () => {
  it.each([
    [70, "70%"],
    [75, "seventy-five percent"],
    [100, "one hundred percent"],
    [70, "seven out of ten confidence"],
    [70, "7/10"],
    [70, "seven in ten"],
    [29, "0.29 probability"],
    [70, "Confidence: 70"],
  ])("supports %s from %s", (candidate, quote) => {
    expect(confidenceMatchesQuote(candidate, quote)).toBe(true);
  });
  it.each([
    [70, "0.7%"],
    [70, "-70%"],
    [70, "fairly confident"],
    [75, "seventy percent"],
    [7, "7/10"],
    [10, "7/10"],
    [70, "eight out of ten"],
  ])("rejects %s when the quote says %s", (candidate, quote) => {
    expect(confidenceMatchesQuote(candidate, quote)).toBe(false);
  });
});
