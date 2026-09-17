import { ImageResponse } from "next/og";
import { BRAND, SITE_TAGLINE } from "@/lib/seo/site";

// Next.js App Router file convention - generates a branded 1200x630 Open
// Graph / Twitter card image at request time (cached), with zero external
// image-editing tooling and no static PNG to keep in sync by hand. Every
// public page that doesn't define its own opengraph-image inherits this one.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND.name} - ${SITE_TAGLINE}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: BRAND.colors.cream,
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Subtle household/finance motif: a few soft rounded shapes, restrained accent color, never filling the frame */}
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 60,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: BRAND.colors.green,
            opacity: 0.12,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 220,
            bottom: 40,
            width: 140,
            height: 140,
            borderRadius: 28,
            background: BRAND.colors.orange,
            opacity: 0.1,
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: BRAND.colors.primary,
              display: "flex",
            }}
          />
          <span style={{ fontSize: 34, fontWeight: 700, color: BRAND.colors.primary, letterSpacing: -0.5 }}>
            {BRAND.name}
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#0f2937", lineHeight: 1.05, maxWidth: 820 }}>
          {SITE_TAGLINE}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#64748b", marginTop: 24, maxWidth: 720 }}>
          A smarter way to track everyday household spending.
        </div>
      </div>
    ),
    { ...size }
  );
}
