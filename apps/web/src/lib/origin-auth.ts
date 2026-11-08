import { timingSafeEqual } from "node:crypto";

export const WEB_ORIGIN_AUTH_HEADER = "x-contractflow-origin-auth";

const HEALTH_PATH = "/health";

export function isWebOriginRequestAllowed(
  path: string,
  expectedSecret: string | undefined,
  suppliedSecret: string | null,
  requireSecret = false,
): boolean {
  /*
   * Leave the dedicated Railway health endpoint available even if the
   * production origin-auth secret is accidentally removed.
   */
  if (path === HEALTH_PATH) {
    return true;
  }

  /*
   * Development/test may run without an origin secret. Production fails
   * closed so removing WEB_ORIGIN_AUTH_SECRET cannot silently disable the
   * origin lock.
   */
  if (!expectedSecret) {
    return !requireSecret;
  }

  if (!suppliedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret);
  const suppliedBuffer = Buffer.from(suppliedSecret);

  if (expectedBuffer.length !== suppliedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}
