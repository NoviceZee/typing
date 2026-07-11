import { describe, expect, it, vi } from "vitest";
import { getSupabaseUserRole } from "./roleStorage";

describe("roleStorage", () => {
  it("returns admin only when the trusted role row says admin", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getSupabaseUserRole("user-1", { from })).resolves.toBe("admin");
    expect(from).toHaveBeenCalledWith("user_roles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("defaults missing and unknown roles to user", async () => {
    const missingClient = makeClient(null);
    const unknownClient = makeClient({ role: "owner" });

    await expect(getSupabaseUserRole("user-1", missingClient)).resolves.toBe("user");
    await expect(getSupabaseUserRole("user-1", unknownClient)).resolves.toBe("user");
  });

  it("fails closed when the role query fails", async () => {
    const error = new Error("role lookup failed");
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getSupabaseUserRole("user-1", { from })).rejects.toThrow("role lookup failed");
  });
});

function makeClient(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })) };
}
