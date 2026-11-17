import type { MetadataRoute } from "next";

const baseUrl = "https://app.contractflowops.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = ["/", "/privacy", "/terms", "/ai-disclosure", "/subprocessors"];

  return publicRoutes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.3,
  }));
}
