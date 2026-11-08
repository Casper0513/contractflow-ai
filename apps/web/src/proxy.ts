import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { isWebOriginRequestAllowed, WEB_ORIGIN_AUTH_HEADER } from "./lib/origin-auth";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    const expectedOriginSecret = process.env.WEB_ORIGIN_AUTH_SECRET;
    const suppliedOriginSecret = request.headers.get(WEB_ORIGIN_AUTH_HEADER);

    if (
      !isWebOriginRequestAllowed(
        request.nextUrl.pathname,
        expectedOriginSecret,
        suppliedOriginSecret,
        process.env.NODE_ENV === "production",
      )
    ) {
      return Response.json(
        {
          statusCode: 403,
          message: "Forbidden",
        },
        {
          status: 403,
        },
      );
    }

    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  },
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "connect-src": [
          "https://api.contractflowops.com",
          "https://o1314875.ingest.us.sentry.io",
          "https://contractflow-photos.9aa36e9371a28e75b07e5b6b8db6af7d.r2.cloudflarestorage.com",
        ],
        "frame-ancestors": ["'none'"],
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
