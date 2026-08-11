import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSupabaseOrigin } from "./supabaseClient";

describe("Supabase connection hints", () => {
  it("derives only the public Supabase origin from the configured URL", () => {
    expect(getSupabaseOrigin("https://project-ref.supabase.co/rest/v1/passages?apikey=not-used")).toBe(
      "https://project-ref.supabase.co"
    );
    expect(getSupabaseOrigin("not a URL")).toBeNull();
    expect(getSupabaseOrigin(undefined)).toBeNull();
  });

  it("adds one conditional preconnect for the derived Supabase origin", () => {
    const appSource = readFileSync("pages/_app.tsx", "utf8");

    expect(appSource).toContain('rel="preconnect"');
    expect(appSource).toContain("href={supabaseOrigin}");
    expect(appSource).not.toContain("supabase.co\"");
  });
});
