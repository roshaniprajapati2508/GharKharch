"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, PieChart, FileBarChart, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/more", label: "More & Settings", icon: Settings },
] as const;

export function SidebarNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-6 md:flex">
      <div className="mb-6 px-2">
        <Logo />
      </div>

      <Button size="lg" className="mb-6 w-full" onClick={onAddClick}>
        <Plus className="h-4 w-4" />
        Add Expense
      </Button>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
