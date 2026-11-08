import { timingSafeEqual } from "node:crypto";

export const WEB_ORIGIN_AUTH_HEADER = "x-contractflow-origin-auth";

const HEALTH_PATH = "/health";

export function isWebOriginRequestAllowed(
  path: string,
  expectedSecret: string | undefined,
  suppliedSecret: string | null,
): boolean {
  /*
   * Staged rollout:
   * Origin authentication is disabled until WEB_ORIGIN_AUTH_SECRET exists.
   */
  if (!expectedSecret) {
    return true;
  }

  /*
   * Leave a dedicated health endpoint available for Railway.
   */
  if (path === HEALTH_PATH) {
    return true;
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
