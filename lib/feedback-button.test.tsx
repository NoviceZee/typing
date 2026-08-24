/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackButton } from "@/components/FeedbackButton";

describe("FeedbackButton", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is a normal same-origin link with no external-protocol dispatch", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<FeedbackButton />);
    const feedback = screen.getByRole("link", { name: "Feedback" });

    expect(feedback.getAttribute("href")).toBe("/feedback");
    expect(feedback.getAttribute("target")).toBeNull();
    expect(feedback.getAttribute("href")).not.toContain("mailto:");

    feedback.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(feedback);

    expect(open).not.toHaveBeenCalled();
  });

  it("remains keyboard focusable", () => {
    render(<FeedbackButton />);
    const feedback = screen.getByRole("link", { name: "Feedback" });

    feedback.focus();

    expect(document.activeElement).toBe(feedback);
  });
});
