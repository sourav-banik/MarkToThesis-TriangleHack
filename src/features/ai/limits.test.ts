import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { acquireParserSlot } from "./limits";
describe("parser request bounds", () => {
  it("rejects overlapping requests and releases capacity", () => {
    const release = acquireParserSlot("concurrent-user", 1000);
    expect(() => acquireParserSlot("concurrent-user", 1000)).toThrow("Please wait");
    release();
    const second = acquireParserSlot("concurrent-user", 1000);
    second();
  });
  it("limits each account to six calls per process window and resets afterward", () => {
    for (let index = 0; index < 6; index++) acquireParserSlot("limited-user", 1000)();
    expect(() => acquireParserSlot("limited-user", 2000)).toThrow("Please wait");
    acquireParserSlot("other-user", 2000)();
    acquireParserSlot("limited-user", 62000)();
  });
});
