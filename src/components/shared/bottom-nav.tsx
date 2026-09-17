"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, PieChart, FileBarChart, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
] as const;

export function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <div className="relative mx-auto grid max-w-md grid-cols-5 px-2 pb-1 pt-2">
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[11px] font-medium"
            >
              <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
              <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{item.label}</span>
            </Link>
          );
        })}

        {/* Spacer for the floating Add button */}
        <div aria-hidden />

        {NAV_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[11px] font-medium"
            >
              <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
              <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onAddClick}
          aria-label="Add expense"
          className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </nav>
  );
}
