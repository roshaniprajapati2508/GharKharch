"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, PieChart, FileBarChart, Settings, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullLogo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/lib/context/search-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/more", label: "More & Settings", icon: Settings },
] as const;

export function SidebarNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();
  const { openSearch } = useSearch();

  return (
    <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-border bg-card px-2 py-6 sm:flex md:w-64 md:items-stretch md:px-4">
      <div className="mb-6 flex w-full justify-center px-2">
        <FullLogo width={40} className="h-auto w-auto md:hidden" />
        <FullLogo width={150} className="hidden md:block" />
      </div>

      <Button
        size="lg"
        className="mb-3 w-full justify-center px-0 md:justify-center md:px-4"
        onClick={onAddClick}
        aria-label="Add expense"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">Add Expense</span>
      </Button>

      <button
        type="button"
        onClick={openSearch}
        title="Search (⌘K)"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-surface/80 p-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground md:justify-between md:px-3 md:py-2 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">Search expenses…</span>
        </div>
        <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground md:inline-block">
          ⌘K
        </kbd>
      </button>

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
