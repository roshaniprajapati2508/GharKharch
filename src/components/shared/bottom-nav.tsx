"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MobileBottomItem {
  page: string;
  href: string;
  label: string;
  iconClass: string;
  exact?: boolean;
}

const PRIMARY_MOBILE_ITEMS: MobileBottomItem[] = [
  { page: "dashboard", href: "/dashboard", label: "Home", iconClass: "ri-home-5-line", exact: true },
  { page: "expenses", href: "/expenses", label: "Kharche", iconClass: "ri-money-dollar-circle-line" },
  { page: "analytics", href: "/analytics", label: "Analytics", iconClass: "ri-line-chart-line" },
  { page: "reports", href: "/reports", label: "Reports", iconClass: "ri-file-chart-line" },
];

const MORE_MENU_ITEMS: MobileBottomItem[] = [
  { page: "dashboard", href: "/dashboard", label: "Home", iconClass: "ri-home-5-line", exact: true },
  { page: "expenses", href: "/expenses", label: "Kharche", iconClass: "ri-money-dollar-circle-line" },
  { page: "analytics", href: "/analytics", label: "Analytics", iconClass: "ri-line-chart-line" },
  { page: "reports", href: "/reports", label: "Reports", iconClass: "ri-file-chart-line" },
  { page: "categories", href: "/more/categories", label: "Categories", iconClass: "ri-price-tag-3-line" },
  { page: "merchants", href: "/more/merchants", label: "Merchants", iconClass: "ri-store-2-line" },
  { page: "budgets", href: "/more/budgets", label: "Budgets", iconClass: "ri-safe-2-line" },
  { page: "recurring", href: "/more/recurring", label: "Recurring", iconClass: "ri-repeat-line" },
  { page: "rules", href: "/more/rules", label: "Smart Rules", iconClass: "ri-flashlight-line" },
  { page: "scratchpad", href: "/more/scratchpad", label: "Scratchpad", iconClass: "ri-edit-line" },
  { page: "duplicates", href: "/more/duplicates", label: "Duplicates", iconClass: "ri-git-merge-line" },
  { page: "payment-methods", href: "/more/payment-methods", label: "Payments", iconClass: "ri-bank-card-line" },
  { page: "activity", href: "/more/activity", label: "Activity", iconClass: "ri-history-line" },
  { page: "ask", href: "/more/ask", label: "Ask AI", iconClass: "ri-sparkling-line" },
  { page: "settings", href: "/more", label: "Settings", iconClass: "ri-settings-4-line", exact: true },
];

export function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const pathname = usePathname();

  const isItemActive = (item: MobileBottomItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const isMoreActive =
    pathname.startsWith("/more") ||
    MORE_MENU_ITEMS.slice(4).some((item) => isItemActive(item));

  return (
    <>
      {/* Mobile Bottom Navigation Bar with Apple Liquid Glass styling */}
      <div id="mobile-bottom-nav">
        {PRIMARY_MOBILE_ITEMS.map((item) => {
          const active = isItemActive(item);
          return (
            <Link
              key={item.page}
              href={item.href}
              prefetch={true}
              data-page={item.page}
              className={cn("mb-nav-btn ni", active && "active")}
            >
              <i className={item.iconClass} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Dynamic "More" Drawer Trigger */}
        <button
          className={cn("mb-nav-btn", isMoreActive && "active")}
          id="mobile-more-btn"
          type="button"
          aria-label="More navigation options"
        >
          <i className="ri-apps-2-line" id="mobile-more-btn-icon" aria-hidden="true" />
          <span>More</span>
        </button>
      </div>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        id="mobile-fab"
        type="button"
        onClick={onAddClick}
        aria-label="Create New Record"
        title="Create New Record"
      >
        <i className="ri-add-line" aria-hidden="true" />
      </button>

      {/* Mobile More Menu Bottom Sheet Overlay (Opens ABOVE the bottom dock) */}
      <div className="mobile-menu-overlay" id="mobile-more-menu" aria-modal="true" role="dialog">
        <div className="mobile-menu-sheet">
          <div className="mobile-menu-header">
            <h3>GharKharch Menu</h3>
            <button
              className="mobile-menu-close"
              id="mobile-menu-close-btn"
              type="button"
              aria-label="Close navigation sheet"
            >
              &times;
            </button>
          </div>
          <div className="mobile-menu-grid">
            {MORE_MENU_ITEMS.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={`more-${item.page}`}
                  href={item.href}
                  prefetch={true}
                  data-page={item.page}
                  className={cn("mobile-menu-item ni", active && "active")}
                >
                  <div className="menu-icon-wrapper">
                    <i className={item.iconClass} aria-hidden="true" />
                  </div>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
