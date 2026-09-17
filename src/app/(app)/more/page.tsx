"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, LogOut, Users, Tag, Store, Wallet, ChevronRight, Sparkles, Merge, Home, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useHousehold } from "@/lib/context/household-context";
import { createClient } from "@/lib/supabase/client";

function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-4">
      <Icon className="h-4 w-4 text-brand-primary" />
      <span className="text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export default function MorePage() {
  const router = useRouter();
  const { householdName, inviteCode, displayName, avatarUrl, partner } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied");
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">More</h1>

      {/* Profile section (spec items 54, 96) */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Users}>Profile</SectionLabel>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Link href="/more/profile" className="flex items-center gap-3">
              <UserAvatar name={displayName} avatarUrl={avatarUrl} />
              <div className="text-sm">
                <p className="font-medium text-foreground">{displayName}</p>
                <p className="text-muted-foreground">You · Edit profile</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Household section */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Home}>Household</SectionLabel>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{householdName}</CardTitle>
            <CardDescription>Shared by you {partner ? `and ${partner.displayName}` : "— invite your partner to join"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {partner && (
              <div className="flex items-center gap-3">
                <UserAvatar name={partner.displayName} avatarUrl={partner.avatarUrl} />
                <div className="text-sm">
                  <p className="font-medium text-foreground">{partner.displayName}</p>
                  <p className="text-muted-foreground">Partner</p>
                </div>
              </div>
            )}

            {!partner && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-foreground">Invite code</p>
                  <p className="mt-1 text-xs text-muted-foreground">Share this with your partner so they can join.</p>
                  <button
                    onClick={copyCode}
                    className="mt-2 flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted px-3 py-2.5 text-left"
                  >
                    <span className="font-mono text-base font-semibold tracking-widest text-foreground">{inviteCode}</span>
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Money section: categories, merchants, dedup tooling, payment instruments */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Wallet}>Money</SectionLabel>
        <Card>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            <MenuLink href="/more/categories" icon={Tag} label="Categories" />
            <MenuLink href="/more/merchants" icon={Store} label="Merchants" />
            <MenuLink href="/more/duplicates" icon={Merge} label="Find duplicates" />
            <MenuLink href="/more/payment-methods" icon={Wallet} label="Payment methods, cards & UPI" />
          </CardContent>
        </Card>
      </div>

      {/* App section */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Sparkles}>App</SectionLabel>
        <Card>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            <MenuLink href="/more/ask" icon={Sparkles} label="Ask GharKharch" />
          </CardContent>
        </Card>
      </div>

      {/* Security section */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={ShieldCheck}>Security</SectionLabel>
        <Card>
          <CardContent className="pt-6">
            <Button variant="outline" className="w-full text-destructive" onClick={signOut} loading={signingOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
