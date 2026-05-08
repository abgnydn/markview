import type { MetadataRoute } from "next";

// Required for Next 16 + `output: export` — the sitemap is fully static.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://markview.ai";
  const now = new Date();

  // Top-level public pages — keep in sync with the directories under app/.
  // /temple intentionally omitted: gated behind NEXT_PUBLIC_TEMPLE_ENABLED
  // and not part of the public surface.
  const routes = [
    "",
    "/docs",
    "/pricing",
    "/privacy",
    "/terms",
    "/agent",
    "/vault",
    "/brain",
    "/investors",
  ];

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1.0 : 0.7,
  }));
}
