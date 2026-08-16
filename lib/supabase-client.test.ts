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
    const metadataSource = readFileSync("components/SiteMetadata.tsx", "utf8");

    expect(metadataSource.match(/rel="preconnect"/g)).toHaveLength(1);
    expect(metadataSource).toContain("href={supabaseOrigin}");
    expect(metadataSource).not.toContain("supabase.co\"");
  });
});
