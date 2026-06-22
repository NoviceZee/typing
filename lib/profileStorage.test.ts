import { describe, expect, it, vi } from "vitest";
import {
  AVATAR_BUCKET,
  getSupabaseAvatarPublicUrl,
  getProfileDisplayLabel,
  getSupabasePublicProfileByHandle,
  normalizeHandle,
  removeSupabaseProfileAvatar,
  setSupabaseProfileHandle,
  uploadSupabaseProfileAvatar,
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
    expect(select).toHaveBeenCalledWith("handle,bio,avatar_style,avatar_path,created_at");
    expect(eq).toHaveBeenCalledWith("handle", "formal_typist");
  });

  it("builds public avatar URLs from stored avatar paths", () => {
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/avatar.webp" } }));
    const from = vi.fn(() => ({ getPublicUrl }));
    const storage = { from };

    expect(getSupabaseAvatarPublicUrl("user-1/avatar.webp", { storage } as any)).toBe(
      "https://cdn.example.com/avatar.webp"
    );
    expect(from).toHaveBeenCalledWith(AVATAR_BUCKET);
    expect(getPublicUrl).toHaveBeenCalledWith("user-1/avatar.webp");
    expect(getSupabaseAvatarPublicUrl(null, { storage } as any)).toBeNull();
  });

  it("uploads avatar files to a user-scoped storage path and updates the profile", async () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const upload = vi.fn().mockResolvedValue({ data: { path: "user-1/avatar.png" }, error: null });
    const single = vi.fn().mockResolvedValue({
      data: { user_id: "user-1", avatar_path: "user-1/avatar.png" },
      error: null
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi
      .fn()
      .mockReturnValueOnce({ upload })
      .mockReturnValueOnce({ update });
    const client = { storage: { from }, from };

    await expect(uploadSupabaseProfileAvatar("user-1", file, client as any)).resolves.toMatchObject({
      avatar_path: "user-1/avatar.png"
    });

    expect(from).toHaveBeenNthCalledWith(1, AVATAR_BUCKET);
    expect(upload).toHaveBeenCalledWith("user-1/avatar.png", file, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: true
    });
    expect(update).toHaveBeenCalledWith({ avatar_path: "user-1/avatar.png" });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("removes the current avatar file and clears the profile avatar path", async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const single = vi.fn().mockResolvedValue({
      data: { user_id: "user-1", avatar_path: null },
      error: null
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi
      .fn()
      .mockReturnValueOnce({ remove })
      .mockReturnValueOnce({ update });
    const client = { storage: { from }, from };

    await expect(removeSupabaseProfileAvatar("user-1", "user-1/avatar.png", client as any)).resolves.toMatchObject({
      avatar_path: null
    });

    expect(remove).toHaveBeenCalledWith(["user-1/avatar.png"]);
    expect(update).toHaveBeenCalledWith({ avatar_path: null });
  });

  it("falls back to handle-only public profile reads before identity migration is applied", async () => {
    const expandedMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42703", message: "column public_profiles.bio does not exist" }
    });
    const fallbackMaybeSingle = vi.fn().mockResolvedValue({
      data: { handle: "formal_typist" },
      error: null
    });
    const expandedEq = vi.fn(() => ({ maybeSingle: expandedMaybeSingle }));
    const fallbackEq = vi.fn(() => ({ maybeSingle: fallbackMaybeSingle }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ eq: expandedEq })
      .mockReturnValueOnce({ eq: fallbackEq });
    const from = vi.fn(() => ({ select }));

    await expect(getSupabasePublicProfileByHandle("formal_typist", { from })).resolves.toEqual({
      handle: "formal_typist",
      bio: null,
      avatar_style: null,
      avatar_path: null,
      created_at: null
    });

    expect(select).toHaveBeenNthCalledWith(1, "handle,bio,avatar_style,avatar_path,created_at");
    expect(select).toHaveBeenNthCalledWith(2, "handle");
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
