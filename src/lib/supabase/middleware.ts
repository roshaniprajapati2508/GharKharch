import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/auth");
  // Public marketing/SEO surface (spec: "SEO & Discoverability Layer" section 1/12) -
  // must stay reachable by anonymous visitors and crawlers, since they never carry
  // a Supabase session cookie. Keep this list in sync with lib/seo/site.ts's
  // PUBLIC_PATHS plus the Next.js metadata-route conventions it doesn't cover.
  const isPublicSeoRoute =
    path === "/privacy" ||
    path === "/terms" ||
    path === "/opengraph-image" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml";
  const isProtectedRoute = !isAuthRoute && !isPublicSeoRoute && path !== "/";

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && !path.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
