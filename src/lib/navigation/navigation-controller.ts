"use client";

// --- Navigation & Sidebar Controller ---
export const MORE_ONLY_PAGES = [
  "reports",
  "categories",
  "merchants",
  "budgets",
  "recurring",
  "rules",
  "scratchpad",
  "duplicates",
  "payment-methods",
  "activity",
  "ask",
  "import",
  "settings",
  "invoices",
  "changelog",
];

export interface NavigationSystemOptions {
  onNavigate?: (page: string) => void;
}

export function initNavigationSystem({ onNavigate }: NavigationSystemOptions = {}) {
  if (typeof window === "undefined") return () => {};

  const root = document.documentElement;

  // 1. Restore Sidebar Collapsed Preference
  try {
    const savedCollapsed = localStorage.getItem("crm-sidebar-collapsed") === "1";
    if (savedCollapsed) {
      root.setAttribute("data-sidebar-collapsed", "true");
      root.classList.add("lk-nav-collapsed");
    }
  } catch (e) {
    // Ignore localStorage errors (e.g. incognito)
  }
  syncSidebarCollapseState();

  // 2. Toggle Sidebar Collapse Function
  function toggleSidebarCollapse() {
    const isCollapsed =
      root.getAttribute("data-sidebar-collapsed") === "true" ||
      root.classList.contains("lk-nav-collapsed");
    const next = !isCollapsed;

    if (next) {
      root.setAttribute("data-sidebar-collapsed", "true");
      root.classList.add("lk-nav-collapsed");
    } else {
      root.removeAttribute("data-sidebar-collapsed");
      root.classList.remove("lk-nav-collapsed");
    }

    try {
      localStorage.setItem("crm-sidebar-collapsed", next ? "1" : "0");
    } catch (e) {}

    syncSidebarCollapseState();
  }

  // 3. Synchronize ARIA & Press States
  function syncSidebarCollapseState() {
    const isCollapsed = root.getAttribute("data-sidebar-collapsed") === "true";
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    if (toggleBtn) {
      toggleBtn.setAttribute(
        "aria-label",
        isCollapsed ? "Expand sidebar (Ctrl+\\)" : "Collapse sidebar (Ctrl+\\)"
      );
      toggleBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }
  }

  // 4. Mobile "More" Drawer Helpers
  let isDrawerHistoryPushed = false;

  function setMoreBtnIcon(open: boolean) {
    const icon = document.getElementById("mobile-more-btn-icon");
    if (!icon) return;
    icon.classList.toggle("ri-close-line", open);
    icon.classList.toggle("ri-apps-2-line", !open);
  }

  function openMobileDrawer() {
    const menu = document.getElementById("mobile-more-menu");
    if (!menu) return;
    menu.classList.add("open");
    const moreBtn = document.getElementById("mobile-more-btn");
    moreBtn?.classList.add("active");
    setMoreBtnIcon(true);

    if (!isDrawerHistoryPushed) {
      isDrawerHistoryPushed = true;
      try {
        window.history.pushState({ mobileDrawerOpen: true }, "");
      } catch (e) {
        // Ignore pushState errors in sandboxed environments
      }
    }
  }

  function closeMobileDrawer(
    activePage?: string,
    options?: { fromPopState?: boolean; isNavigation?: boolean }
  ) {
    const menu = document.getElementById("mobile-more-menu");
    if (menu) {
      menu.classList.remove("open");
    }
    setMoreBtnIcon(false);

    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    const isCurrentlyOnMorePage =
      currentPath.startsWith("/more") ||
      currentPath.startsWith("/reports") ||
      (Boolean(activePage) && MORE_ONLY_PAGES.includes(activePage!));

    if (!isCurrentlyOnMorePage) {
      document.getElementById("mobile-more-btn")?.classList.remove("active");
    }

    if (isDrawerHistoryPushed) {
      isDrawerHistoryPushed = false;
      if (options?.fromPopState) {
        // Popstate already occurred, history was already popped by browser
      } else if (options?.isNavigation) {
        // User clicked a navigation link, replace state so there's no ghost drawer in history
        try {
          window.history.replaceState(null, "", window.location.href);
        } catch (e) {}
      } else {
        // Closed manually via back button, close button, backdrop, Escape, etc.
        try {
          window.history.back();
        } catch (e) {}
      }
    }
  }

  // 5. Browser Back Navigation Handler (Hardware/Browser Back Button & Swipe Back)
  function handlePopState() {
    const menu = document.getElementById("mobile-more-menu");
    if (menu?.classList.contains("open") || isDrawerHistoryPushed) {
      closeMobileDrawer(undefined, { fromPopState: true });
    }
  }

  // 6. Global Delegated Click Handler
  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Sidebar Collapse Button Click
    if (target.closest('[data-action="toggle-sidebar-collapse"]')) {
      toggleSidebarCollapse();
      return;
    }

    // Mobile More Button Click: toggles the drawer
    const moreBtn = target.closest("#mobile-more-btn");
    if (moreBtn) {
      const menu = document.getElementById("mobile-more-menu");
      const isOpen = menu?.classList.contains("open") ?? false;
      if (isOpen) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
      return;
    }

    // Close Mobile Drawer on Back Button, Close Button, or Backdrop Click
    const backBtn = target.closest("#mobile-menu-back-btn");
    const closeBtn = target.closest("#mobile-menu-close-btn");
    const overlay = target.closest(".mobile-menu-overlay");
    if (backBtn || closeBtn || (overlay && !target.closest(".mobile-menu-sheet"))) {
      closeMobileDrawer();
      return;
    }

    // Page Button Click (.ni or [data-page])
    const pageButton = target.closest("[data-page]") as HTMLElement | null;
    if (pageButton) {
      const page = pageButton.dataset.page;
      if (page) {
        closeMobileDrawer(page, { isNavigation: true });

        // Sync active classes across sidebar, bottom nav, and drawer
        document.querySelectorAll(".ni").forEach((btn) => btn.classList.remove("active"));
        document.querySelectorAll(`.ni[data-page="${page}"]`).forEach((btn) =>
          btn.classList.add("active")
        );

        if (MORE_ONLY_PAGES.includes(page)) {
          document.getElementById("mobile-more-btn")?.classList.add("active");
        }

        if (typeof onNavigate === "function") {
          onNavigate(page);
        }
      }
      return;
    }

    // Defensive: any link inside drawer should close the drawer with clean history
    if (target.closest(".mobile-menu-sheet a")) {
      closeMobileDrawer(undefined, { isNavigation: true });
    }
  }

  // 7. Keyboard Shortcut: Ctrl+\ or Cmd+\ & Escape
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
      event.preventDefault();
      toggleSidebarCollapse();
    }
    if (event.key === "Escape") {
      closeMobileDrawer();
    }
  }

  // 8. Window Resize Listener
  function handleResize() {
    syncSidebarCollapseState();
  }

  document.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("popstate", handlePopState);

  return () => {
    document.removeEventListener("click", handleClick);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("popstate", handlePopState);
  };
}
