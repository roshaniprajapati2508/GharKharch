"use client";

// --- Navigation & Sidebar Controller ---
export const MORE_ONLY_PAGES = [
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
  function setMoreBtnIcon(open: boolean) {
    const icon = document.getElementById("mobile-more-btn-icon");
    if (!icon) return;
    icon.classList.toggle("ri-close-line", open);
    icon.classList.toggle("ri-apps-2-line", !open);
  }

  function closeMobileDrawer(activePage?: string) {
    const menu = document.getElementById("mobile-more-menu");
    if (menu) {
      menu.classList.remove("open");
    }
    setMoreBtnIcon(false);
    if (!activePage || !MORE_ONLY_PAGES.includes(activePage)) {
      document.getElementById("mobile-more-btn")?.classList.remove("active");
    }
  }

  // 5. Global Delegated Click Handler
  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Sidebar Collapse Button Click
    if (target.closest('[data-action="toggle-sidebar-collapse"]')) {
      toggleSidebarCollapse();
      return;
    }

    // Mobile More Button Click
    const moreBtn = target.closest("#mobile-more-btn");
    if (moreBtn) {
      const menu = document.getElementById("mobile-more-menu");
      const isOpen = menu?.classList.toggle("open") ?? false;
      moreBtn.classList.toggle("active", isOpen);
      setMoreBtnIcon(isOpen);
      return;
    }

    // Close Mobile Drawer on Close Button or Backdrop Click
    const closeBtn = target.closest("#mobile-menu-close-btn");
    const overlay = target.closest(".mobile-menu-overlay");
    if (closeBtn || (overlay && !target.closest(".mobile-menu-sheet"))) {
      closeMobileDrawer();
      return;
    }

    // Page Button Click (.ni or [data-page])
    const pageButton = target.closest("[data-page]") as HTMLElement | null;
    if (pageButton) {
      const page = pageButton.dataset.page;
      if (page) {
        closeMobileDrawer(page);

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
    }
  }

  // 6. Keyboard Shortcut: Ctrl+\ or Cmd+\ & Escape
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
      event.preventDefault();
      toggleSidebarCollapse();
    }
    if (event.key === "Escape") {
      closeMobileDrawer();
    }
  }

  // 7. Window Resize Listener
  function handleResize() {
    syncSidebarCollapseState();
  }

  document.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize, { passive: true });

  return () => {
    document.removeEventListener("click", handleClick);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
  };
}
