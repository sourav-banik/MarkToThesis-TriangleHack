import { describe, expect, it } from "vitest";
import { defaultTerms } from "../../demo/claims";
import { instrumentCatalog, instruments } from "../market-data/catalog";
import { liveClaimRequestSchema } from "./live-contracts";

const request = () => ({
  idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  originalText: "Apple will outperform SPY.",
  visibility: "private",
  terms: {
    ...defaultTerms,
    assumptions: [],
    rationale: "" as string,
    instrument: instruments.aapl,
    prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
    horizon: { kind: "duration", value: 30, unit: "days" },
  },
});

describe("live commitment input boundary", () => {
  it("accepts prospective terms without a client owner, timestamp, price, or result", () => {
    expect(liveClaimRequestSchema.safeParse(request()).success).toBe(true);
  });
  it.each(["authorId", "committedAt", "context", "startingPrice", "resolution", "claimId"])(
    "rejects client-supplied %s",
    (field) => {
      expect(liveClaimRequestSchema.safeParse({ ...request(), [field]: "spoof" }).success).toBe(
        false,
      );
    },
  );
  it("requires an explicit stable idempotency key", () => {
    expect(
      liveClaimRequestSchema.safeParse({ ...request(), idempotencyKey: undefined }).success,
    ).toBe(false);
  });
  it("rejects a changed identity with a reused ticker", () => {
    const body = request();
    body.terms.instrument = { ...instruments.aapl, definition: "A different listing." };
    expect(liveClaimRequestSchema.safeParse(body).success).toBe(false);
  });
  it("does not silently assign a provider to an unbound gold price forecast", () => {
    const body = request();
    body.terms.instrument = instruments.gold;
    expect(liveClaimRequestSchema.safeParse(body).success).toBe(false);
  });
  it.each(instrumentCatalog)(
    "can log an unscored position stance for $symbol without a pricing provider",
    (instrument) => {
      const body = request();
      expect(
        liveClaimRequestSchema.safeParse({
          ...body,
          terms: {
            ...body.terms,
            instrument,
            prediction: { kind: "hold", meaning: { kind: "maintain_position" } },
          },
        }).success,
      ).toBe(true);
    },
  );
  it("rejects duplicate assumption IDs before evidence can become ambiguous", () => {
    const body = request();
    const assumption = {
      id: "same",
      statement: "Growth persists.",
      falsificationCondition: "Growth slows.",
    };
    expect(
      liveClaimRequestSchema.safeParse({
        ...body,
        terms: { ...body.terms, assumptions: [assumption, assumption] },
      }).success,
    ).toBe(false);
  });
  it("bounds rationale and original text", () => {
    expect(
      liveClaimRequestSchema.safeParse({ ...request(), originalText: "x".repeat(8001) }).success,
    ).toBe(false);
    const body = request();
    body.terms.rationale = "x".repeat(8001);
    expect(liveClaimRequestSchema.safeParse(body).success).toBe(false);
  });
});
