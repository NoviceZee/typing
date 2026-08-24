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

  it("opens one mailto per explicit activation and never retries on lifecycle events", () => {
    vi.useFakeTimers();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<FeedbackButton />);
    const feedback = screen.getByRole("link", { name: "Feedback" });

    fireEvent.click(feedback);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith(
      "mailto:feedback@typingstation.app",
      "_blank",
      "noopener,noreferrer"
    );

    vi.runAllTimers();
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.runAllTimers();

    expect(open).toHaveBeenCalledTimes(1);

    fireEvent.click(feedback);

    expect(open).toHaveBeenCalledTimes(2);
  });

  it("remains a keyboard-focusable mailto link", () => {
    render(<FeedbackButton />);
    const feedback = screen.getByRole("link", { name: "Feedback" });

    feedback.focus();

    expect(document.activeElement).toBe(feedback);
    expect(feedback.getAttribute("href")).toBe("mailto:feedback@typingstation.app");
  });
});
