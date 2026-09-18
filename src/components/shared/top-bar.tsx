"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Bell } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ActivityInboxSheet } from "@/components/shared/activity-inbox-sheet";
import { getUnreadActivityCount } from "@/lib/actions/activity-events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FullLogo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/lib/context/household-context";
import { useSearch } from "@/lib/context/search-context";

export function TopBar() {
  const router = useRouter();
  const { displayName, avatarUrl, householdName } = useHousehold();
  const { openSearch } = useSearch();
  const [signingOut, setSigningOut] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  async function refreshUnread() {
    const result = await getUnreadActivityCount();
    if (result.data !== null) setUnreadCount(result.data);
  }

  useEffect(() => {
    refreshUnread();
    // Light polling (not a realtime subscription - this is a two-person
    // household app, a minute of staleness on an unread badge is fine)
    // so the badge updates even if the partner logged something while
    // this tab was open.
    const timer = setInterval(refreshUnread, 60000);
    return () => clearInterval(timer);
  }, []);

  // Glassmorphic sticky header with scroll-triggered elevation (spec:
  // Module 2 "Mercury & Stripe" visual polish) - the header is already
  // sticky/blurred; this adds a shadow only once the page has actually
  // scrolled under it, so it reads as "floating above content" rather than
  // a flat divider line at rest.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      className={`safe-top sticky top-0 z-30 flex h-[70px] items-center justify-between border-b px-4 backdrop-blur-md bg-background/80 transition-shadow duration-200 sm:h-16 md:px-6 ${
        scrolled ? "border-border/60 shadow-md" : "border-border/40 shadow-none"
      }`}
    >
      <Link href="/dashboard" className="flex items-center py-1 sm:hidden">
        <FullLogo width={180} className="h-14 w-auto object-contain" />
      </Link>
      <div className="hidden text-sm text-muted-foreground sm:block">{householdName}</div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search expenses"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <Search className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setInboxOpen(true)}
          aria-label="Activity"
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <ActivityInboxSheet open={inboxOpen} onOpenChange={setInboxOpen} onReadStateChange={refreshUnread} />

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <UserAvatar name={displayName} avatarUrl={avatarUrl} className="h-9 w-9" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/more">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} disabled={signingOut} className="text-destructive">
              {signingOut && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
