import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using GharKharch, a private household expense tracker for two people.",
  alternates: { canonical: absoluteUrl("/terms") },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[15px] leading-relaxed text-foreground">
      <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: 17 September 2026</p>

      <p className="mb-6">
        By creating a GharKharch account, you agree to these terms. GharKharch is designed for exactly two people
        sharing one household&apos;s expenses.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Your responsibilities</h2>
      <p className="mb-4">
        You&apos;re responsible for the accuracy of the data you enter and for keeping your account credentials secure.
        Only invite someone you actually share household finances with using your household&apos;s invite code.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">No financial advice</h2>
      <p className="mb-4">
        GharKharch tracks and summarizes spending you enter. It does not provide financial, investment, tax, or legal
        advice, and nothing in the app should be treated as such.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">AI-assisted features</h2>
      <p className="mb-4">
        Features like &quot;Ask GharKharch&quot; and receipt scanning use AI to assist with parsing and answering
        questions. Always confirm what a receipt scan captured before saving it - the app never saves an AI-parsed
        expense without your review.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Availability</h2>
      <p className="mb-4">The app is provided as-is, without warranty of uninterrupted availability.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Changes</h2>
      <p className="mb-4">These terms may be updated from time to time; continued use after a change means you accept the update.</p>

      <p className="mt-10 text-xs text-muted-foreground">
        This page is a plain-language summary, not a substitute for legal advice - have it reviewed before relying on it
        for compliance purposes.
      </p>
    </main>
  );
}
