import { describe, expect, it } from "vitest";
import { detectTextLanguage } from "./textFileImport";

describe("text file import", () => {
  it("detects Chinese passages without relying on the filename", () => {
    expect(detectTextLanguage("客戶已確認修訂後的交付時間。請安排下星期會議。" )).toBe("chinese");
    expect(detectTextLanguage("Please confirm the revised delivery schedule.")).toBe("english");
  });

  it("keeps mixed formal English text in the English library", () => {
    expect(detectTextLanguage("Meeting 安排: please review the attached proposal before Friday.")).toBe("english");
  });
});
