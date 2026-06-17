import { describe, expect, it } from "vitest";
import { isRestartShortcut } from "./practiceShortcuts";

describe("practice shortcuts", () => {
  it("detects Tab plus Enter as the restart shortcut", () => {
    expect(isRestartShortcut({ key: "Enter", tabKey: true })).toBe(true);
  });

  it("ignores plain Enter and plain Tab", () => {
    expect(isRestartShortcut({ key: "Enter", tabKey: false })).toBe(false);
    expect(isRestartShortcut({ key: "Tab", tabKey: true })).toBe(false);
  });
});
