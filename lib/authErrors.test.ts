import { describe, expect, it } from "vitest";
import { formatPasswordResetError } from "./authErrors";

describe("password reset error messages", () => {
  it("turns provider rate-limit errors into a useful recovery instruction", () => {
    expect(formatPasswordResetError("email rate limit exceeded"))
      .toBe("Too many recovery emails have been requested. Use the newest reset email already sent, or try again later.");
  });

  it("does not expose unexpected provider error details", () => {
    expect(formatPasswordResetError("internal provider detail"))
      .toBe("The reset email could not be sent. Check your connection and try again later.");
  });
});
