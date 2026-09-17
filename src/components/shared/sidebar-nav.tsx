"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, PieChart, FileBarChart, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullLogo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/more", label: "More & Settings", icon: Settings },
] as const;

// `sm` (≥640px) through just under `md` (≥768, e.g. a Galaxy Tab S4 in
// portrait at 712px) gets a compact icon-only rail instead of the phone's
// bottom nav (which hides at that same `sm` breakpoint - see bottom-nav.tsx)
// or the full labeled sidebar - the same pattern used by Gmail, Slack, and
// most enterprise apps for tablet-width screens, so a tablet always gets a
// layout that uses its width instead of being stuck with the phone UI.
export function SidebarNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-border bg-card px-2 py-6 sm:flex md:w-64 md:items-stretch md:px-4">
      <div className="mb-6 flex w-full justify-center px-2">
        <FullLogo width={40} className="h-auto w-auto md:hidden" />
        <FullLogo width={150} className="hidden md:block" />
      </div>

      <Button
        size="lg"
        className="mb-6 w-full justify-center px-0 md:justify-center md:px-4"
        onClick={onAddClick}
        aria-label="Add expense"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">Add Expense</span>
      </Button>

      <nav className="flex flex-1 flex-col items-center gap-1 md:items-stretch" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              title={item.label}
              className={cn(
                "flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-start",
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="hidden whitespace-nowrap md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
