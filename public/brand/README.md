# Brand assets

Static brand assets served directly by Next.js (`/brand/...`).

- `logo-full.png` — the approved full lockup (icon + wordmark + tagline), used by `FullLogo` in `src/components/shared/logo.tsx` on auth screens and printable reports.

PWA icons and favicons stay in `public/icons/` (referenced by `manifest.json` and `src/app/layout.tsx`'s metadata) rather than here, since moving them would require re-registering every favicon/manifest path for no benefit — this folder is for brand imagery used inside the product UI.

Brand colors and tokens are not duplicated here; they live as the single source of truth in `src/app/globals.css` (`--brand-*` CSS custom properties under `:root`).
