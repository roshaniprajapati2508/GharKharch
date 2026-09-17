import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GharKharch handles your household's expense data: what's stored, what's never stored, and who can see it.",
  alternates: { canonical: absoluteUrl("/privacy") },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[15px] leading-relaxed text-foreground">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: 17 September 2026</p>

      <p className="mb-6">
        GharKharch is a private household expense tracker built for two people to share. This page explains what
        information the app stores, why, and what it deliberately never stores.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">What we store</h2>
      <p className="mb-4">
        Your account email, the expenses, categories, merchants, budgets, and recurring bills you and your household
        partner enter, and any receipt photos you choose to attach. Data lives in a Supabase-hosted database and is
        protected by row-level access rules, so only the two members of a household can ever see that household&apos;s data.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">What we never store</h2>
      <p className="mb-4">
        Full card numbers, CVV codes, card or UPI PINs, or net-banking passwords. Payment tracking only stores a label
        you choose (like &quot;HDFC Debit&quot;), never the actual card or account number.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">AI features</h2>
      <p className="mb-4">
        If you use &quot;Ask GharKharch&quot; or receipt scanning, the relevant text or image is sent to OpenAI&apos;s API to
        generate a response. No raw database access is ever given to the AI model, and these features work without any
        AI at all if not configured.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Data sharing</h2>
      <p className="mb-4">We do not sell your data or share it with advertisers. Data is only ever visible to the members of your own household.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Your data, your control</h2>
      <p className="mb-4">
        You can export your data at any time (CSV, JSON, or a full household backup) from Reports, and you can delete
        individual expenses or your account.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Contact</h2>
      <p className="mb-4">Questions about this policy can be sent to the app&apos;s maintainer.</p>

      <p className="mt-10 text-xs text-muted-foreground">
        This page is a plain-language summary, not a substitute for legal advice - have it reviewed before relying on it
        for compliance purposes.
      </p>
    </main>
  );
}
