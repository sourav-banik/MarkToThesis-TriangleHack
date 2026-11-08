import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({ createSupabaseServerClient: vi.fn() }));
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { requireAccount, verifiedAccount } from "./server";

beforeEach(() => vi.resetAllMocks());
describe("verified sessions", () => {
  it("does not create a fake user when the connection is absent", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);
    await expect(verifiedAccount()).resolves.toMatchObject({ user: null, client: null });
    await expect(requireAccount()).rejects.toMatchObject({ status: 503 });
  });
  it("does not trust a forged user from a session object", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: null }, error: { message: "Invalid token" } });
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: "forged-owner" } } } });
    const from = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser, getSession },
      from,
    } as unknown as NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>);
    await expect(requireAccount()).rejects.toMatchObject({ status: 401 });
    expect(getUser).toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
