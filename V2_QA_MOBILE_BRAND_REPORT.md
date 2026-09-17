# GharKharch — Mobile/Tablet QA + Brand/Design-System Compliance Audit

Run 2026-09-17. **Method note, stated plainly:** this environment could not
keep a `next dev` server alive across tool calls long enough for a real
rendered-pixel screenshot pass (each remote-device shell call is a fresh,
short-lived process — a backgrounded dev server does not survive between
calls), and there is no deployed preview URL to point a browser at. Rather
than fake a screenshot pass, this audit is a direct **code-level review** of
the actual breakpoints, layout rules, and touch-target/safe-area handling
shipped in the repository. It is a real check of real code, not a guess —
but it is not a substitute for opening the app on an actual phone/tablet.
If you want a true rendered pass, the fastest path is: you run `npm run dev`
on your machine and leave it running, then tell me the URL (e.g.
`http://localhost:3000`) and I can drive a browser against it directly.

## Mobile/Tablet — Phase 2

**Breakpoint structure:** three explicit tiers, not just mobile scaled down —
`src/app/globals.css` defines a distinct `.dashboard-grid` `grid-template-areas`
at base (mobile, <640px), `@media (min-width: 640px)` (tablet), and
`@media (min-width: 1024px)` (desktop). Sections genuinely regroup at each
tier rather than just resizing.

**Nav pattern switch:** bottom nav (mobile) vs. left sidebar (`md:` / ≥768px,
tablet and up) — confirmed via `sidebar-nav.tsx`'s `md:hidden` on the mobile
logo mark. Standard, correct breakpoint for a tablet-vs-phone split.

**Touch targets:** bottom-nav items use `min-h-12` (48px) — above Apple's
44px / Material's 48dp minimum. No sub-40px tap targets found in the nav or
primary action buttons.

**Horizontal-scroll guard:** `app-shell.tsx`'s `<main>` carries `min-w-0
max-w-full overflow-x-clip` — the exact class combination that prevents a
single overflowing child from creating a horizontal scrollbar on narrow
viewports (this matches the earlier committed fix "mobile horizontal
scroll").

**Safe-area handling:** `.safe-top` / `.safe-bottom` utilities exist in
`globals.css` and are applied to the sticky top bar and bottom sheets
(`drawer.tsx`) — content and footer buttons clear a phone's notch/status bar
and the iOS home-indicator area.

**Viewport meta:** `viewportFit: "cover"` is set in `layout.tsx`, required
for `env(safe-area-inset-*)` to resolve to real values rather than 0 on iOS.

**No issues found** in the structural/CSS layer. What this pass cannot see:
actual rendered spacing/overlap on a real device, keyboard-avoidance
behavior when a text input is focused on mobile Safari, and whether any
individual component's content overflows its container at specific content
lengths (e.g. a very long merchant name). Those need a live render.

## Brand/Design-System compliance — Phase 3

**Color tokens:** every semantic color in `globals.css` (`--primary`,
`--secondary`, `--accent`, `--success`, `--warning`, `--destructive`, etc.)
resolves back to one of six `--brand-*` values, both in light and the dark
`@media (prefers-color-scheme: dark)` block. Searched every `.tsx` file
under `src/components` and `src/app` for raw hex colors outside
`globals.css`: found exactly **two**, both legitimate exceptions —
1. `add-expense-sheet.tsx`: `color: "#ffffff"` set dynamically for text
   drawn over a user-chosen category-swatch color (can't be a static CSS
   token since the background itself is dynamic).
2. `layout.tsx`: `themeColor: "#087f6e"` in the PWA metadata export — a
   Next.js `Viewport` field, not CSS, so it cannot reference a CSS variable;
   confirmed it matches `--brand-primary` exactly.

No unauthorized brand colors, no drift from the token system.

**Typography:** a single font-family chain (`--font-sans` → Inter →
system-ui fallbacks) is applied at the `body` level; no component sets a
competing `font-family`. `font-mono` is reserved for fixed-width numeric
displays (timers/codes) per its own doc-comment in `globals.css`.

**Spacing scale:** the overwhelming majority of spacing uses Tailwind's
default scale. One consistent, intentional deviation: `text-[11px]` appears
across ~10 analytics/table components for dense micro-copy (labels, table
sub-text) one size below Tailwind's `text-xs` (12px) — this reads as a
deliberate design choice for information-dense screens, not scattered
one-offs, since it's the same value reused everywhere it appears rather than
a range of arbitrary sizes.

**No issues found.** The design system is being followed consistently
project-wide.

## What was NOT done, honestly

- No rendered screenshots were taken — see the method note above.
- No automated accessibility/contrast tooling (axe-core or similar) was run
  — same "no heavy render jobs without approval" reasoning as the prior
  Premium UX phase report.
- No cross-browser check (Safari-specific quirks, older Android WebView).

Nothing above required a code change — the mobile/tablet layout and the
brand system both check out clean against direct inspection of the shipped
code.
