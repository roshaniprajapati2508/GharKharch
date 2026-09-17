// Real generated PDF report (distinct from the browser-print "Print" button
// in reports-page-client.tsx, which opens the OS print dialog against
// MonthlyReportView's on-screen HTML). This builds an actual .pdf file
// client-side with jsPDF, so it can be saved/shared/attached without going
// through a print dialog at all.
//
// jsPDF's built-in fonts (Helvetica/Times/Courier) don't include the ₹ glyph,
// so amounts here use a plain "Rs." prefix instead of lib/utils.ts's
// formatINR (which is fine for on-screen HTML/CSS but would render as a
// missing-glyph box in the PDF). Everything else reuses the exact numbers
// already computed server-side in ReportData — this file never computes a
// total itself, it only lays text out on a page.

import { jsPDF } from "jspdf";
import type { ReportData } from "@/lib/actions/reports";
import { percentChange } from "@/lib/utils";
import { dayGroupLabel } from "@/lib/date-utils";

const inrGrouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function formatRupeesForPdf(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return "Rs. 0";
  return `Rs. ${inrGrouping.format(Math.round(value))}`;
}

const BRAND_PRIMARY: [number, number, number] = [8, 127, 110]; // #087f6e
const BRAND_MINT: [number, number, number] = [231, 245, 236]; // #e7f5ec
const TEXT_DARK: [number, number, number] = [30, 41, 38];
const TEXT_MUTED: [number, number, number] = [110, 125, 120];

export interface ReportPdfPeople {
  userId: string;
  displayName: string;
  partner: { id: string; displayName: string } | null;
}

/** Builds and triggers a browser download of a real, generated PDF report for `data`, mirroring MonthlyReportView's structure (total, category breakdown, top purchases, previous-period comparison). `people` resolves the anonymous `paid_by` ids in `data.personBreakdown` into display names, the same way MonthlyReportView does via useHousehold() — optional because this function only ever computes layout, never data. */
export function downloadReportPdf(data: ReportData, people?: ReportPdfPeople) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 0;

  const total = parseFloat(data.summary.total);
  const prevTotal = parseFloat(data.previousSummary.total);
  const change = percentChange(total, prevTotal);

  // Header band
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 0, pageWidth, 110, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GharKharch", margin, 32);
  doc.setFontSize(20);
  doc.text(data.range.label, margin, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(30);
  doc.text(formatRupeesForPdf(total), margin, 90);
  doc.setFontSize(10);
  doc.text("spent as a household", margin, 104);

  y = 132;
  doc.setTextColor(...TEXT_DARK);

  // Comparison-with-previous-period line
  if (change !== null && prevTotal > 0) {
    const direction = change <= 0 ? "down" : "up";
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${Math.abs(change).toFixed(1)}% ${direction} vs ${data.previousRange.label.toLowerCase()} (${formatRupeesForPdf(prevTotal)})`, margin, y);
    y += 22;
  }

  // Quick stats row
  doc.setDrawColor(...BRAND_MINT);
  doc.setFillColor(...BRAND_MINT);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 46, 6, 6, "F");
  const statW = (pageWidth - margin * 2) / 3;
  const stats: [string, string][] = [
    ["Transactions", String(data.summary.txn_count)],
    ["Daily average", formatRupeesForPdf(total / Math.max(data.summary.days, 1))],
    ["Top category", data.categoryBreakdown[0]?.category_name ?? "-"],
  ];
  stats.forEach(([label, value], i) => {
    const x = margin + statW * i + statW / 2;
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, x, y + 18, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(value, x, y + 34, { align: "center", maxWidth: statW - 8 });
    doc.setFont("helvetica", "normal");
  });
  y += 70;

  // Category breakdown
  if (data.categoryBreakdown.length > 0) {
    y = sectionHeading(doc, "Where it went", margin, y);
    for (const cat of data.categoryBreakdown.slice(0, 8)) {
      y = ensureRoom(doc, y, 20);
      const pct = total > 0 ? (parseFloat(cat.total) / total) * 100 : 0;
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_DARK);
      doc.text(cat.category_name, margin, y);
      doc.text(`${pct.toFixed(0)}%  ${formatRupeesForPdf(cat.total)}`, pageWidth - margin, y, { align: "right" });
      y += 6;
      // bar
      const barW = pageWidth - margin * 2;
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, y, barW, 4, "F");
      doc.setFillColor(...BRAND_PRIMARY);
      doc.rect(margin, y, Math.min(barW, (barW * pct) / 100), 4, "F");
      y += 16;
    }
    y += 8;
  }

  // Top purchases
  if (data.topExpenses.length > 0) {
    y = sectionHeading(doc, "Top purchases", margin, y);
    doc.setFontSize(10);
    data.topExpenses.slice(0, 8).forEach((e, i) => {
      y = ensureRoom(doc, y, 16);
      doc.setTextColor(...TEXT_DARK);
      doc.text(`${i + 1}. ${e.item_name}`, margin, y, { maxWidth: pageWidth - margin * 2 - 100 });
      doc.setTextColor(...TEXT_MUTED);
      doc.text(dayGroupLabel(e.expense_date), margin + 200, y);
      doc.setTextColor(...TEXT_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(formatRupeesForPdf(e.amount), pageWidth - margin, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 16;
    });
    y += 8;
  }

  // Person comparison (only when we can resolve names — see ReportPdfPeople doc comment)
  if (data.personBreakdown.length > 0 && people) {
    const nameFor = (userId: string) =>
      userId === people.userId ? "You" : people.partner && userId === people.partner.id ? people.partner.displayName.split(" ")[0] : "Household member";
    y = sectionHeading(doc, "Household comparison", margin, y);
    doc.setFontSize(10);
    for (const p of data.personBreakdown) {
      y = ensureRoom(doc, y, 16);
      doc.setTextColor(...TEXT_DARK);
      doc.text(nameFor(p.paid_by), margin, y);
      doc.text(`${formatRupeesForPdf(p.total)} (${p.txn_count})`, pageWidth - margin, y, { align: "right" });
      y += 16;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Generated by GharKharch on ${new Date().toLocaleDateString("en-IN")}`, margin, doc.internal.pageSize.getHeight() - 20);

  doc.save(`gharkharch-${data.range.start}-to-${data.range.end}.pdf`);
}

function sectionHeading(doc: jsPDF, title: string, margin: number, y: number): number {
  y = ensureRoom(doc, y, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(title.toUpperCase(), margin, y);
  doc.setFont("helvetica", "normal");
  return y + 16;
}

function ensureRoom(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 40) {
    doc.addPage();
    return 40;
  }
  return y;
}
