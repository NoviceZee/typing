import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const configPath = require.resolve("../next.config.js");

type NextConfigWithHeaders = {
  poweredByHeader: boolean;
  headers: () => Promise<Array<{ headers: Array<{ key: string; value: string }> }>>;
};

describe("production security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete require.cache[configPath];
  });

  it("applies an enforced CSP and baseline browser hardening globally", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    delete require.cache[configPath];
    const nextConfig = require(configPath) as NextConfigWithHeaders;
    const entries = await nextConfig.headers();
    const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]));

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain("https://*.supabase.co");
    expect(headers["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000");
  });

  it("does not force HTTPS for a local production smoke server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    delete require.cache[configPath];
    const nextConfig = require(configPath) as NextConfigWithHeaders;
    const entries = await nextConfig.headers();
    const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]));

    expect(headers["Content-Security-Policy"]).not.toContain("upgrade-insecure-requests");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
