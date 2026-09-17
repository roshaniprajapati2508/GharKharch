import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_PATHS } from "@/lib/seo/site";

// Next.js App Router file convention - generates /sitemap.xml automatically.
// Deliberately built from PUBLIC_PATHS (lib/seo/site.ts) rather than listed
// by hand here, so a path can never be added to the sitemap without also
// being a real, intentional entry in that single source of truth. Private
// application routes (dashboard, expenses, analytics, reports, more, auth)
// are never included.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
