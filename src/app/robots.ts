import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// Next.js App Router file convention - generates /robots.txt automatically.
// Robots.txt alone is advisory (a well-behaved crawler honors it, nothing
// else does), so it is not relied on as the only protection for private
// data: every authenticated route also carries its own `robots: {index:
// false, follow: false}` via the root layout's default metadata (spec
// section 12 - "Private routes must also use noindex").
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/privacy", "/terms"],
        disallow: [
          "/",
          "/dashboard",
          "/expenses",
          "/analytics",
          "/reports",
          "/more",
          "/login",
          "/signup",
          "/onboarding",
          "/auth",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
