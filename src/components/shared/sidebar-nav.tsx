"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/lib/context/search-context";
import { useHousehold } from "@/lib/context/household-context";

interface NavItem {
  page: string;
  href: string;
  label: string;
  iconClass: string;
  exact?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { page: "dashboard", href: "/dashboard", label: "Dashboard", iconClass: "ri-dashboard-line", exact: true },
      { page: "expenses", href: "/expenses", label: "Expenses & Kharcha", iconClass: "ri-money-dollar-circle-line" },
      { page: "analytics", href: "/analytics", label: "Analytics", iconClass: "ri-line-chart-line" },
      { page: "reports", href: "/reports", label: "Reports", iconClass: "ri-file-chart-line" },
    ],
  },
  {
    title: "Manage & Money",
    items: [
      { page: "categories", href: "/more/categories", label: "Categories", iconClass: "ri-price-tag-3-line" },
      { page: "merchants", href: "/more/merchants", label: "Merchants", iconClass: "ri-store-2-line" },
      { page: "budgets", href: "/more/budgets", label: "Budgets", iconClass: "ri-safe-2-line" },
      { page: "recurring", href: "/more/recurring", label: "Recurring", iconClass: "ri-repeat-line" },
      { page: "rules", href: "/more/rules", label: "Smart Rules", iconClass: "ri-flashlight-line" },
      { page: "scratchpad", href: "/more/scratchpad", label: "Fast Scratchpad", iconClass: "ri-edit-line" },
      { page: "duplicates", href: "/more/duplicates", label: "Find Duplicates", iconClass: "ri-git-merge-line" },
      { page: "payment-methods", href: "/more/payment-methods", label: "Payment Methods", iconClass: "ri-bank-card-line" },
      { page: "activity", href: "/more/activity", label: "Recent Activity", iconClass: "ri-history-line" },
    ],
  },
  {
    title: "Tools & AI",
    items: [
      { page: "ask", href: "/more/ask", label: "Ask GharKharch", iconClass: "ri-sparkling-line" },
      { page: "import", href: "/more/import", label: "Import CSV", iconClass: "ri-upload-cloud-line" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { page: "settings", href: "/more", label: "Settings & More", iconClass: "ri-settings-4-line", exact: true },
    ],
  },
];

export function SidebarNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();
  const { openSearch } = useSearch();
  const { displayName, householdName } = useHousehold();

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "GK";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside className="sidebar" id="sidebar" aria-label="Main navigation">
      {/* Seam-docked Floating Toggle Button */}
      <button
        type="button"
        className="lk-nav-toggle sidebar-collapse-toggle"
        id="sidebar-toggle-btn"
        data-action="toggle-sidebar-collapse"
        aria-controls="sidebar"
        aria-expanded="true"
        aria-label="Toggle sidebar (Ctrl+\)"
      >
        <div className="lk-nav-toggle-inner">
          <svg className="lk-tg-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <rect className="lk-tg-frame" x="2.5" y="3.5" width="19" height="17" rx="4.5"></rect>
            <rect className="lk-tg-panel" x="4.5" y="5.5" width="6.5" height="13" rx="2.2"></rect>
            <g className="lk-tg-dots">
              <circle cx="7.75" cy="9" r=".9"></circle>
              <circle cx="7.75" cy="12" r=".9"></circle>
              <circle cx="7.75" cy="15" r=".9"></circle>
            </g>
            <path className="lk-tg-chev" d="M17.2 9.2 14.4 12l2.8 2.8"></path>
          </svg>
        </div>
      </button>

      {/* Dual Logo: Full brand logo collapses into compact mark */}
      <Link href="/dashboard" className="logo" title="GharKharch">
        <img className="brand-logo-sidebar" src="/brand/logo-full.png" alt="GharKharch Brand Logo" />
        <img className="brand-logo-mark" src="/icons/apple-touch-icon.png" alt="Brand Mark" />
      </Link>

      {/* User / Profile Badge */}
      <Link href="/more/profile" className="user-badge" id="sb-badge" title={`${displayName} (${householdName})`}>
        <div className="ub-av">{getInitials(displayName)}</div>
        <div className="ub-info">
          <div className="ub-name">{displayName || "User"}</div>
          <div className="ub-role">{householdName || "Administrator"}</div>
        </div>
      </Link>

      {/* Quick Action Buttons: Add Record & Command Search */}
      <div className="sidebar-actions">
        <button
          type="button"
          onClick={onAddClick}
          aria-label="Add expense"
          title="Add Expense"
          className="sb-action-btn sb-action-primary"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="sb-btn-text">Add Expense</span>
        </button>

        <button
          type="button"
          onClick={openSearch}
          title="Search expenses (⌘K)"
          aria-label="Search expenses"
          className="sb-action-btn sb-action-search"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="sb-btn-text">Search…</span>
          </div>
          <kbd className="sb-kbd rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation Scroll Area */}
      <nav className="nav" aria-label="Main Navigation Items">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.title || sIdx} className="w-full">
            {section.title && <div className="nav-lbl">{section.title}</div>}
            {section.items.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  data-page={item.page}
                  title={item.label}
                  className={cn("ni", active && "active")}
                >
                  <i className={item.iconClass} aria-hidden="true" />
                  <span className="ni-label truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <Link href="/more" className="sidebar-version-card" data-page="changelog" title="GharKharch CRM v2.4.0">
          <span className="pulse-dot"></span>
          <span className="sidebar-version-badge">v2.4.0</span>
          <span className="sidebar-latest-tag">LATEST</span>
        </Link>
      </div>
    </aside>
  );
}
