/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackPage from "@/pages/feedback";

const FEEDBACK_EMAIL = "feedback@typingstation.app";

describe("FeedbackPage", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies the exact feedback address and announces success accessibly", async () => {
    writeText.mockResolvedValue(undefined);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { container } = render(<FeedbackPage />);

    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Send us feedback." })).toBeTruthy();
    expect(screen.getByText(FEEDBACK_EMAIL)).toBeTruthy();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(FEEDBACK_EMAIL);
    expect(screen.getByRole("status").textContent).toBe("Email address copied.");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(open).not.toHaveBeenCalled();
  });

  it("announces clipboard errors and leaves the address available to copy manually", async () => {
    writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    render(<FeedbackPage />);

    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert").textContent).toBe(
      "Could not copy the email address. Select and copy it manually."
    );
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe("assertive");
    expect(screen.getByText(FEEDBACK_EMAIL)).toBeTruthy();
  });
});
