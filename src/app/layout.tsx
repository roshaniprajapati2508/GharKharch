import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Anek_Gujarati } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_LOCALE, BRAND, absoluteUrl } from "@/lib/seo/site";
import "./globals.css";

// Typography system: Plus Jakarta Sans for headings/titles, Inter for body/UI
// text, and Anek Gujarati for Gujarati text.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});
const anekGujarati = Anek_Gujarati({
  subsets: ["gujarati", "latin"],
  variable: "--font-anek-gujarati",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  // Sensible default for every route: authenticated app screens are never
  // meant to be indexed. Public pages (privacy, terms) override this with
  // their own `robots: { index: true, follow: true }` in their own
  // metadata export - see spec section 12/24.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    locale: SITE_LOCALE,
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: `${BRAND.name} - ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl("/opengraph-image")],
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#087f6e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Tells supporting mobile browsers (Chrome/Android 108+) to actually shrink
  // the layout viewport when the on-screen keyboard opens, instead of
  // overlaying it on top of a viewport that stays full-height. Without this,
  // a fixed bottom sheet sized off vh/dvh can end up with its header pushed
  // above the visible area the instant an input inside it is focused - the
  // exact 'top bar cut off while typing' bug on Add Expense.
  interactiveWidget: "resizes-content",
};

// Organization structured data (spec section 15): only real, verifiable
// facts - name, production URL, logo. No social profiles, no company
// registration info, no address, no founders - none of that exists to
// report, so none of it is fabricated here.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl(BRAND.logoPath),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="gu-IN" className={`${inter.variable} ${plusJakartaSans.variable} ${anekGujarati.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('crm-sidebar-collapsed')==='1'){document.documentElement.classList.add('lk-nav-collapsed');document.documentElement.setAttribute('data-sidebar-collapsed','true');}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
