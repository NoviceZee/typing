/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FaqPage from "@/pages/faq";

describe("FaqPage", () => {
  it("renders grouped, expandable answers and useful routes", () => {
    const { container } = render(<FaqPage />);

    expect(screen.getByRole("heading", { name: /Find your rhythm/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "FAQ categories" })).toBeTruthy();
    expect(container.querySelectorAll("details")).toHaveLength(11);
    expect(screen.getByText("Do I need an account to start typing?")).toBeTruthy();
    expect(screen.getByText("Does Chinese input work with an IME?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start practising/i }).getAttribute("href")).toBe("/practice");
  });
});
