import { describe, expect, it } from "vitest";

import { sanitizeSentryRequestPath } from "../sanitize-sentry-request";

describe("sanitizeSentryRequestPath", () => {
  it("redacts public estimate capability tokens", () => {
    expect(
      sanitizeSentryRequestPath("/e/abcdefghijklmnopqrstuvwxyz0123456789SECRET"),
    ).toBe("/e/:token");
  });

  it("redacts public invoice capability tokens", () => {
    expect(
      sanitizeSentryRequestPath("/i/abcdefghijklmnopqrstuvwxyz0123456789SECRET"),
    ).toBe("/i/:token");
  });

  it("removes query strings", () => {
    expect(
      sanitizeSentryRequestPath(
        "/i/abcdefghijklmnopqrstuvwxyz0123456789SECRET?payment=success",
      ),
    ).toBe("/i/:token");
  });

  it("leaves ordinary application paths unchanged", () => {
    expect(sanitizeSentryRequestPath("/dashboard/jobs/job_1")).toBe(
      "/dashboard/jobs/job_1",
    );
  });
});
