"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  IndianRupee,
  PieChart,
  FileBarChart,
  Settings,
  Plus,
  Search,
  Tag,
  Store,
  PiggyBank,
  Repeat,
  Zap,
  NotebookPen,
  Merge,
  Wallet,
  History,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FullLogo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/lib/context/search-context";
import { useHousehold } from "@/lib/context/household-context";
import { UserAvatar } from "@/components/shared/user-avatar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/expenses", label: "Expenses", icon: IndianRupee },
      { href: "/analytics", label: "Analytics", icon: PieChart },
      { href: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    title: "Manage & Money",
    items: [
      { href: "/more/categories", label: "Categories", icon: Tag },
      { href: "/more/merchants", label: "Merchants", icon: Store },
      { href: "/more/budgets", label: "Budgets", icon: PiggyBank },
      { href: "/more/recurring", label: "Recurring", icon: Repeat },
      { href: "/more/rules", label: "Smart Rules", icon: Zap },
      { href: "/more/scratchpad", label: "Fast Scratchpad", icon: NotebookPen },
      { href: "/more/duplicates", label: "Find Duplicates", icon: Merge },
      { href: "/more/payment-methods", label: "Payment Methods", icon: Wallet },
      { href: "/more/activity", label: "Recent Activity", icon: History },
    ],
  },
  {
    title: "Tools & AI",
    items: [
      { href: "/more/ask", label: "Ask GharKharch", icon: Sparkles },
      { href: "/more/import", label: "Import CSV", icon: UploadCloud },
    ],
  },
  {
    title: "Preferences",
    items: [
      { href: "/more", label: "More & Settings", icon: Settings, exact: true },
    ],
  },
];

export function SidebarNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();
  const { openSearch } = useSearch();
  const { displayName, avatarUrl, householdName } = useHousehold();

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-border bg-card sm:flex md:w-64">
      {/* Top Header: Logo */}
      <div className="flex shrink-0 items-center justify-center border-b border-border/40 px-3 py-4 md:justify-start md:px-5">
        <FullLogo width={40} className="h-auto w-auto md:hidden" />
        <FullLogo width={140} className="hidden h-auto md:block" />
      </div>

      {/* Action Buttons: Add Expense & Search */}
      <div className="shrink-0 space-y-2 p-3 pb-2 md:px-4 md:pt-4">
        <Button
          size="lg"
          className="w-full justify-center px-0 font-medium shadow-sm transition-transform active:scale-[0.98] md:h-10 md:justify-center md:px-4 md:text-sm"
          onClick={onAddClick}
          aria-label="Add expense"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline md:ml-1.5">Add Expense</span>
        </Button>

        <button
          type="button"
          onClick={openSearch}
          title="Search (⌘K)"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-surface/80 p-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground md:justify-between md:px-3 md:py-2 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">Search expenses…</span>
          </div>
          <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground md:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 md:px-3" aria-label="Primary">
        <div className="space-y-4">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-1">
              {section.title && (
                <div className="hidden px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase md:block">
                  {section.title}
                </div>
              )}
              {sIdx > 0 && <div className="my-1.5 border-t border-border/50 md:hidden" />}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      title={item.label}
                      className={cn(
                        "group flex w-full items-center justify-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all md:justify-start md:text-sm",
                        active
                          ? "bg-secondary font-semibold text-secondary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                          active ? "text-brand-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="hidden truncate md:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* User / Household footer */}
      <div className="shrink-0 border-t border-border/50 p-2 md:p-3">
        <Link
          href="/more/profile"
          className="flex w-full items-center justify-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/70 md:justify-start md:p-2"
          title={`${displayName} (${householdName})`}
        >
          <UserAvatar name={displayName} avatarUrl={avatarUrl} className="h-8 w-8" />
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{householdName}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
