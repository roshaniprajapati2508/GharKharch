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

type NavItem = (typeof NAV_ITEMS)[number];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-lg py-1 text-[11px] font-medium"
    >
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("whitespace-nowrap", active ? "text-primary" : "text-muted-foreground")}>
        {item.label}
      </span>
    </Link>
  );
}

// Phones only — from `sm` up, `SidebarNav` takes over (a compact icon rail at
// sm/md, the full labeled sidebar at md+), so this never has to squeeze onto
// a tablet-width screen. Real bottom bars (iOS/Android system, most shopping
// and banking apps) never spend a whole column on empty space just to make
// room for a raised centre button — they size the button to fit within the
// bar and give every label its own full-width flex slot instead of a shared
// grid column, which is what was causing "More" to wrap on narrower phones.
export function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur sm:hidden"
      aria-label="Primary"
    >
      <div className="relative mx-auto flex max-w-md items-center gap-1 px-2 pb-1 pt-2">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Reserved footprint for the floating Add button below — matches its
            h-14 (56px) width exactly, so it never steals width from a label. */}
        <div className="w-14 shrink-0" aria-hidden />

        {NAV_ITEMS.slice(2).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

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
