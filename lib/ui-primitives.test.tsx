/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Check, X } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton, SegmentedControl } from "@/components/Controls";
import { DataSurface, EmptyState, PageSection, SectionStack, StatusMessage } from "@/components/Surface";

describe("shared UI controls", () => {
  it("gives buttons the shared focus contract and hides decorative icons", () => {
    render(<Button icon={Check}>Continue</Button>);

    const button = screen.getByRole("button", { name: "Continue" });
    button.focus();

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("data-focus-ring")).toBe("standard");
    expect(button.getAttribute("data-touch-target")).toBe("44");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("requires an accessible label for icon-only controls", () => {
    render(<IconButton icon={X} label="Close" />);

    const button = screen.getByRole("button", { name: "Close" });
    expect(button.getAttribute("title")).toBe("Close");
    expect(button.getAttribute("data-touch-target")).toBe("44");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes segmented choices as an accessible group with pressed state", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Writing language"
        value="english"
        onChange={onChange}
        options={[
          { label: "English", value: "english" },
          { label: "Chinese", value: "chinese" }
        ]}
      />
    );

    expect(screen.getByRole("group", { name: "Writing language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("data-selected-indicator")).toBe("underline");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("data-touch-target")).toBe("44");

    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));
    expect(onChange).toHaveBeenCalledWith("chinese");
  });
});

describe("shared UI surfaces", () => {
  it("provides semantic page and data grouping without prescribing content", () => {
    render(
      <SectionStack>
        <PageSection aria-label="Overview">Overview content</PageSection>
        <DataSurface aria-label="Results">Results content</DataSurface>
      </SectionStack>
    );

    expect(screen.getByRole("region", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Results" })).toBeTruthy();
  });

  it("assigns polite status and assertive alert semantics by tone", () => {
    render(
      <>
        <StatusMessage tone="success">Saved</StatusMessage>
        <StatusMessage tone="danger">Could not save</StatusMessage>
      </>
    );

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe("assertive");
  });

  it("exposes asynchronous empty results as a status", () => {
    render(<EmptyState>No results yet.</EmptyState>);

    expect(screen.getByRole("status").textContent).toBe("No results yet.");
  });
});
