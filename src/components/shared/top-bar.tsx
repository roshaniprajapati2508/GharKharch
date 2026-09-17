"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
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

export function TopBar() {
  const router = useRouter();
  const { displayName, avatarUrl, householdName } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="safe-top sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="sm:hidden">
        <FullLogo width={125} className="h-12 w-auto object-contain" />
      </div>
      <div className="hidden text-sm text-muted-foreground sm:block">{householdName}</div>

      <div className="flex items-center gap-1">
        <Link
          href="/expenses?focus=search"
          aria-label="Search expenses"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-5 w-5" />
        </Link>

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
