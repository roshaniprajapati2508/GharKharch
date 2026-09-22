"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, PieChart, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/expenses", label: "Kharche", icon: Receipt },
] as const;

const RIGHT_NAV_ITEMS = [
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
] as const;

type NavItem = (typeof LEFT_NAV_ITEMS)[number] | (typeof RIGHT_NAV_ITEMS)[number];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      prefetch={true}
      className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-lg py-1 text-[11px] font-medium"
    >
      <Icon className={cn("h-5 w-5 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("whitespace-nowrap transition-colors", active ? "font-semibold text-primary" : "text-muted-foreground")}>
        {item.label}
      </span>
    </Link>
  );
}

export function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md sm:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 py-1">
        {LEFT_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Center elevated floating Add button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onAddClick}
            aria-label="Add expense"
            className="flex h-12 w-12 -translate-y-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95 hover:bg-primary/90"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>

        {RIGHT_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

