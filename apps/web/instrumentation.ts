import * as Sentry from "@sentry/nextjs";

import { sanitizeSentryRequestPath } from "./src/lib/sanitize-sentry-request";

const dataCollection = {
  userInfo: false,
  cookies: false,
  httpBodies: [],
  databaseQueryData: false,
  queues: false,
  genAI: {
    inputs: false,
    outputs: false,
  },
};

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: process.env.NODE_ENV === "production",
      tracesSampleRate: 0.1,
      dataCollection,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: process.env.NODE_ENV === "production",
      tracesSampleRate: 0.1,
      dataCollection,
    });
  }
}

export const onRequestError: typeof Sentry.captureRequestError = (
  error,
  request,
  errorContext,
) => {
  Sentry.captureRequestError(
    error,
    {
      path: sanitizeSentryRequestPath(request.path),
      method: request.method,
      headers: {},
    },
    errorContext,
  );
};
