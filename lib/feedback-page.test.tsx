/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackPage from "@/pages/feedback";

const FEEDBACK_EMAIL = "feedback@typingstation.app";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body)
  };
}

describe("FeedbackPage", () => {
  const writeText = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the static feedback form with a required message and no temporary copy", () => {
    const { container } = render(<FeedbackPage />);
    const message = screen.getByLabelText("Message") as HTMLTextAreaElement;

    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Send us feedback." })).toBeTruthy();
    expect(screen.getByLabelText("Category")).toBeTruthy();
    expect(message.required).toBe(true);
    expect(screen.getByLabelText("Reply email (optional)")).toBeTruthy();
    expect(screen.getByText(FEEDBACK_EMAIL)).toBeTruthy();
    expect(container.textContent).not.toContain("built-in feedback form is coming later");
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("does not submit when the required message is empty", () => {
    render(<FeedbackPage />);

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits valid feedback and announces success accessibly", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    render(<FeedbackPage />);

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Suggestion" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Add a shorter code drill." } });
    fireEvent.change(screen.getByLabelText("Reply email (optional)"), { target: { value: "typist@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "Suggestion",
        message: "Add a shorter code drill.",
        replyEmail: "typist@example.com",
        website: ""
      })
    });
    expect(screen.getByRole("status").textContent).toBe("Feedback sent. Thank you for helping improve Typing Station.");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });

  it("submits without Reply-To when the optional reply email is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    render(<FeedbackPage />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "The content filter is useful." } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(expect.objectContaining({ replyEmail: "" }));
  });

  it("preserves form data and announces delivery failures accessibly", async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, {
      error: "Feedback could not be sent. Please try again or use the email address below."
    }));
    render(<FeedbackPage />);

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Content" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "A passage has a typo." } });
    fireEvent.change(screen.getByLabelText("Reply email (optional)"), { target: { value: "reader@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Feedback could not be sent");
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe("assertive");
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("Content");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("A passage has a typo.");
    expect((screen.getByLabelText("Reply email (optional)") as HTMLInputElement).value).toBe("reader@example.com");
  });

  it("preserves form data and shows an accessible retry message when rate limited", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, {
      error: "Too many feedback submissions. Please wait before trying again."
    }));
    render(<FeedbackPage />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please keep this draft." } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Please wait before trying again");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("Please keep this draft.");
  });

  it("prevents duplicate submissions while the request is in flight", async () => {
    let resolveRequest: ((value: ReturnType<typeof jsonResponse>) => void) | undefined;
    fetchMock.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<FeedbackPage />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "One submission only." } });
    const form = screen.getByRole("button", { name: "Send feedback" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement).disabled).toBe(true);

    resolveRequest?.(jsonResponse(200, { ok: true }));
    await screen.findByRole("status");
  });

  it("copies the fallback email address and announces success accessibly", async () => {
    writeText.mockResolvedValue(undefined);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<FeedbackPage />);

    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FEEDBACK_EMAIL));
    expect(screen.getByRole("status").textContent).toBe("Email address copied.");
    expect(open).not.toHaveBeenCalled();
  });

  it("announces clipboard errors and leaves the address available to copy manually", async () => {
    writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    render(<FeedbackPage />);

    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not copy the email address. Select and copy it manually."
    );
    expect(screen.getByText(FEEDBACK_EMAIL)).toBeTruthy();
  });
});
