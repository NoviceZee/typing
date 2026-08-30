/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChineseTypingPage from "@/pages/chinese-typing";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("ChineseTypingPage", () => {
  it("renders one visible Traditional Chinese H1 and the approved compact content", () => {
    const { container } = render(<ChineseTypingPage />);
    const headings = screen.getAllByRole("heading", { level: 1 });

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe("繁體中文打字練習");
    expect(headings[0].className).not.toContain("sr-only");
    expect(container.querySelector('[lang="zh-Hant"]')).toBeTruthy();
    expect(screen.getByText("選擇計時或不限時練習，使用你慣用的中文輸入法完成文章；毋須登入即可開始。")).toBeTruthy();
    expect(screen.getByText("中文輸入法與組字")).toBeTruthy();
    expect(screen.getByText("完成後可以看到甚麼")).toBeTruthy();
    expect(container.textContent).not.toContain("CPM");
  });

  it.each([
    ["開始一分鐘中文練習", "/practice?language=chinese&mode=1m"],
    ["開始不限時練習", "/practice?language=chinese&mode=infinite"],
    ["瀏覽中文文章", "/passages?language=chinese"],
    ["開始中文集中訓練", "/training?content=chinese"],
    ["查看輸入法常見問題", "/faq#practice"]
  ])("links %s to the approved destination", (label, href) => {
    render(<ChineseTypingPage />);

    expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
  });
});
