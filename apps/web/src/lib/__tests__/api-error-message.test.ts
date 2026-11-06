import { describe, expect, it } from "vitest";

import { parseApiErrorMessage } from "../api-error-message";

describe("parseApiErrorMessage", () => {
  it("returns a structured API message", () => {
    expect(
      parseApiErrorMessage(
        JSON.stringify({
          message: "The requested action could not be completed.",
        }),
      ),
    ).toBe("The requested action could not be completed.");
  });

  it("joins structured validation messages", () => {
    expect(
      parseApiErrorMessage(
        JSON.stringify({
          message: ["Name is required.", "Email is invalid."],
        }),
      ),
    ).toBe("Name is required. Email is invalid.");
  });

  it("returns a structured API error field", () => {
    expect(
      parseApiErrorMessage(
        JSON.stringify({
          error: "Conflict",
        }),
      ),
    ).toBe("Conflict");
  });

  it("does not expose non-JSON response bodies", () => {
    expect(
      parseApiErrorMessage(
        "provider failure customer@example.com req_sensitive provider_secret",
      ),
    ).toBeNull();
  });

  it("does not expose malformed JSON", () => {
    expect(parseApiErrorMessage('{"message":"provider_secret"')).toBeNull();
  });

  it("ignores unsupported response shapes", () => {
    expect(
      parseApiErrorMessage(
        JSON.stringify({
          message: {
            secret: "provider_secret",
          },
        }),
      ),
    ).toBeNull();
  });

  it("does not expose structured messages from server errors", () => {
    expect(
      parseApiErrorMessage(
        JSON.stringify({
          message: "database connection provider_secret",
        }),
        500,
      ),
    ).toBeNull();
  });

  it("still exposes structured messages from expected client errors", () => {
    expect(
      parseApiErrorMessage(
        JSON.stringify({
          message: "The requested action could not be completed.",
        }),
        400,
      ),
    ).toBe("The requested action could not be completed.");
  });
});
