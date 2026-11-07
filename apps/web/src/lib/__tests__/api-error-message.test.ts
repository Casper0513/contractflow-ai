import { describe, expect, it } from "vitest";

import { getApiErrorMessage, parseApiErrorMessage } from "../api-error-message";

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

describe("getApiErrorMessage", () => {
  it("returns the safe fallback for server errors", () => {
    expect(
      getApiErrorMessage(
        JSON.stringify({
          message: "database connection provider_secret",
        }),
        500,
        "Unable to complete this request.",
      ),
    ).toBe("Unable to complete this request.");
  });

  it("returns a structured message for expected client errors", () => {
    expect(
      getApiErrorMessage(
        JSON.stringify({
          message: "The requested action could not be completed.",
        }),
        400,
        "Unable to complete this request.",
      ),
    ).toBe("The requested action could not be completed.");
  });

  it("returns the safe fallback for malformed or non-JSON responses", () => {
    expect(
      getApiErrorMessage(
        "provider failure customer@example.com provider_secret",
        400,
        "Unable to complete this request.",
      ),
    ).toBe("Unable to complete this request.");
  });
});
