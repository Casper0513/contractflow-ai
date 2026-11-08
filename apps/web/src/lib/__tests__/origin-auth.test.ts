import { describe, expect, it } from "vitest";

import { isWebOriginRequestAllowed } from "../origin-auth";

describe("isWebOriginRequestAllowed", () => {
  const expectedSecret = "contractflow-web-origin-auth-test-secret-0123456789";

  it("allows requests when origin authentication is not configured", () => {
    expect(isWebOriginRequestAllowed("/dashboard", undefined, null)).toBe(true);
  });

  it("allows the health endpoint without the origin header", () => {
    expect(isWebOriginRequestAllowed("/health", expectedSecret, null)).toBe(true);
  });

  it("allows a request with the correct origin secret", () => {
    expect(isWebOriginRequestAllowed("/dashboard", expectedSecret, expectedSecret)).toBe(
      true,
    );
  });

  it("rejects a request without the origin secret", () => {
    expect(isWebOriginRequestAllowed("/dashboard", expectedSecret, null)).toBe(false);
  });

  it("rejects a request with an incorrect origin secret", () => {
    expect(
      isWebOriginRequestAllowed(
        "/dashboard",
        expectedSecret,
        "incorrect-web-origin-auth-secret-0123456789",
      ),
    ).toBe(false);
  });
});
