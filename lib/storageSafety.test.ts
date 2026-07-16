import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  TYPING_STATION_STORAGE_MIGRATION_KEY,
  getTypingStationStorageReport,
  runTypingStationStorageMigration,
  safeSetStorageItem
} from "./storageSafety";

describe("storageSafety", () => {
  it("catches quota failures for app-owned writes without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {
      localStorage: makeStorage({
        setItem: () => {
          throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        }
      })
    });

    expect(() =>
      safeSetStorageItem("formaltype_previous_results", "x".repeat(1024), { context: "test-quota" })
    ).not.toThrow();
    expect(safeSetStorageItem("formaltype_previous_results", "x", { context: "test-quota" })).toMatchObject({
      ok: false,
      reason: "quota_exceeded"
    });
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("STORAGE QUOTA FAILURE"))).toBe(true);

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("does not hide non-quota programming errors", () => {
    vi.stubGlobal("window", {
      localStorage: makeStorage({
        setItem: () => {
          throw new TypeError("bad write");
        }
      })
    });

    expect(() => safeSetStorageItem("formaltype_previous_results", "x", { context: "test-error" })).toThrow("bad write");

    vi.unstubAllGlobals();
  });

  it("treats a blocked Safari storage getter as unavailable", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const blockedWindow = {} as Window;
    Object.defineProperty(blockedWindow, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access is denied.", "SecurityError");
      }
    });
    vi.stubGlobal("window", blockedWindow);

    expect(safeSetStorageItem("formaltype_previous_results", "x", { context: "test-blocked" })).toMatchObject({
      ok: false,
      reason: "unavailable"
    });

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("treats a browser SecurityError during storage writes as unavailable", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {
      localStorage: makeStorage({
        setItem: () => {
          throw new DOMException("Access is denied.", "SecurityError");
        }
      })
    });

    expect(safeSetStorageItem("formaltype_previous_results", "x", { context: "test-security" })).toMatchObject({
      ok: false,
      reason: "unavailable"
    });

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("reports Typing Station storage usage largest first without inspecting unrelated keys", () => {
    const storage = makeStorage();
    storage.setItem("formaltype_previous_results", "a".repeat(50));
    storage.setItem("formaltype_current_passage", "b".repeat(10));
    storage.setItem("sb-project-auth-token", "secret".repeat(100));

    const report = getTypingStationStorageReport(storage);

    expect(report.entries.map((entry) => entry.key)).toEqual(["formaltype_previous_results", "formaltype_current_passage"]);
    expect(report.entries[0].approximateBytes).toBe(100);
    expect(report.totalApproximateBytes).toBe(120);
  });

  it("removes only known obsolete Typing Station keys during migration", () => {
    const storage = makeStorage();
    storage.setItem("formaltype.passage.v1", "obsolete");
    storage.setItem("formaltype_current_passage", "keep active passage cache");
    storage.setItem("formaltype.theme.v1", "keep settings");
    storage.setItem("sb-project-auth-token", "keep auth");
    const clearSpy = vi.spyOn(storage, "clear");
    vi.stubGlobal("window", { localStorage: storage });

    runTypingStationStorageMigration(storage);

    expect(storage.getItem("formaltype.passage.v1")).toBeNull();
    expect(storage.getItem("formaltype_current_passage")).toBe("keep active passage cache");
    expect(storage.getItem("formaltype.theme.v1")).toBe("keep settings");
    expect(storage.getItem("sb-project-auth-token")).toBe("keep auth");
    expect(storage.getItem(TYPING_STATION_STORAGE_MIGRATION_KEY)).toBe("complete");
    expect(clearSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("keeps production app-owned writes behind the central safe storage wrapper", () => {
    const root = process.cwd();
    const productionFiles = collectFiles(root, [".ts", ".tsx"]).filter(
      (file) =>
        !file.includes(`${path.sep}node_modules${path.sep}`) &&
        !file.includes(`${path.sep}.next${path.sep}`) &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".test.tsx")
    );
    const rawSetItemFiles = productionFiles.filter((file) => {
      if (file.endsWith(`${path.sep}storageSafety.ts`)) {
        return false;
      }

      return /(?:window\.)?(?:localStorage|sessionStorage)\.setItem\(/.test(fs.readFileSync(file, "utf8"));
    });

    expect(rawSetItemFiles.map((file) => path.relative(root, file))).toEqual([]);
  });
});

function makeStorage(overrides: Partial<Storage> = {}): Storage {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    ...overrides
  };

  return storage;
}

function collectFiles(directory: string, extensions: string[]): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
        continue;
      }

      files.push(...collectFiles(fullPath, extensions));
      continue;
    }

    if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files;
}
