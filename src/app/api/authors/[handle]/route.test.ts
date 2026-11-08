import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({ createPublicSupabaseClient: vi.fn() }));
vi.mock("@/features/profiles/server", () => ({ getPublicProfile: vi.fn() }));
vi.mock("@/features/feed/server", () => ({ listClaimFeed: vi.fn(), getRecordSummary: vi.fn() }));
import { GET } from "./route";
import { createPublicSupabaseClient } from "@/lib/server/supabase";
import { getPublicProfile } from "@/features/profiles/server";
import { listClaimFeed, getRecordSummary } from "@/features/feed/server";
import { HttpError } from "@/lib/server/http";
const client = {} as NonNullable<ReturnType<typeof createPublicSupabaseClient>>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createPublicSupabaseClient).mockReturnValue(client);
  vi.mocked(getPublicProfile).mockResolvedValue({
    id: "public-owner",
    handle: "analyst",
    displayName: "Analyst",
    bio: "",
  });
  vi.mocked(listClaimFeed).mockResolvedValue({ claims: [], nextCursor: null });
  vi.mocked(getRecordSummary).mockResolvedValue({ total: 34, scored: 20, met: 12, notMet: 8, pending: 9, unclear: 1, unscored: 4 });
});
describe("public author HTTP boundary", () => {
  it("uses the looked-up author and a public-only scope for both records and full-history counts", async () => {
    const response = await GET(
      new Request("http://localhost/api/authors/analyst?ownerId=other&q=gold"),
      { params: Promise.resolve({ handle: "analyst" }) },
    );
    expect(response.status).toBe(200);
    expect(listClaimFeed).toHaveBeenCalledWith(
      client,
      { ownerId: "public-owner", publicOnly: true },
      expect.objectContaining({ q: "gold" }),
      null,
    );
    expect(getRecordSummary).toHaveBeenCalledWith(client, {
      ownerId: "public-owner",
      publicOnly: true,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects private author filters instead of widening access", async () => {
    expect(
      (
        await GET(new Request("http://localhost/api/authors/analyst?visibility=private"), {
          params: Promise.resolve({ handle: "analyst" }),
        })
      ).status,
    ).toBe(400);
    expect(listClaimFeed).not.toHaveBeenCalled();
  });
  it("returns a real 404 for absent authors", async () => {
    vi.mocked(getPublicProfile).mockRejectedValue(
      new HttpError(404, "This author is unavailable."),
    );
    expect(
      (
        await GET(new Request("http://localhost/api/authors/missing"), {
          params: Promise.resolve({ handle: "missing" }),
        })
      ).status,
    ).toBe(404);
    expect(listClaimFeed).not.toHaveBeenCalled();
  });
});
