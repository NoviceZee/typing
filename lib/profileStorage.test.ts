import { describe, expect, it, vi } from "vitest";
import {
  getProfileDisplayLabel,
  getSupabasePublicProfileByHandle,
  normalizeHandle,
  setSupabaseProfileHandle,
  updateSupabaseProfileIdentity,
  validateHandle
} from "./profileStorage";

describe("profileStorage handles", () => {
  it("normalizes and validates lowercase URL-safe handles", () => {
    expect(normalizeHandle(" Formal_Typist9 ")).toBe("formal_typist9");
    expect(validateHandle("formal_typist9")).toEqual({ isValid: true, handle: "formal_typist9" });
  });

  it("rejects handles outside the public format", () => {
    expectInvalidHandle("ft", "Handle must be 3-20 characters.");
    expectInvalidHandle("formal-typist", "Use letters, numbers, and underscores only.");
    expectInvalidHandle("formal typist", "Use letters, numbers, and underscores only.");
    expectInvalidHandle("formaltypistformaltypist", "Handle must be 3-20 characters.");
  });

  it("maps duplicate handle database errors to a friendly message", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" }
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));

    await expect(setSupabaseProfileHandle("user-1", "taken_handle", { from })).rejects.toThrow(
      "That handle is already taken."
    );
  });

  it("uses handle only for public labels and never falls back to display name or email", () => {
    expect(getProfileDisplayLabel({ handle: "formal_typist" })).toBe("@formal_typist");
    expect(getProfileDisplayLabel({ handle: null })).toBe("Account");
    expect(getProfileDisplayLabel(null)).toBe("Account");
  });

  it("loads public profiles by normalized handle", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { handle: "formal_typist" },
      error: null
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getSupabasePublicProfileByHandle(" Formal_Typist ", { from })).resolves.toEqual({
      handle: "formal_typist"
    });

    expect(from).toHaveBeenCalledWith("public_profiles");
    expect(select).toHaveBeenCalledWith("handle,bio,avatar_style,created_at");
    expect(eq).toHaveBeenCalledWith("handle", "formal_typist");
  });

  it("updates public identity fields for the current profile", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        display_name: "Formal Typist",
        handle: "formal_typist",
        bio: "Quiet hands, loud WPM.",
        avatar_style: "amber",
        public_profile_enabled: true
      },
      error: null
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));

    await expect(
      updateSupabaseProfileIdentity(
        "user-1",
        { bio: " Quiet hands, loud WPM. ", avatar_style: "amber", public_profile_enabled: true },
        { from }
      )
    ).resolves.toMatchObject({ bio: "Quiet hands, loud WPM.", avatar_style: "amber" });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({
      bio: "Quiet hands, loud WPM.",
      avatar_style: "amber",
      public_profile_enabled: true
    });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

function expectInvalidHandle(handle: string, message: string) {
  const result = validateHandle(handle);
  expect(result.isValid).toBe(false);

  if (!result.isValid) {
    expect(result.message).toBe(message);
  }
}
