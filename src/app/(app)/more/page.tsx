"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Copy,
  LogOut,
  Users,
  Tag,
  Store,
  Zap,
  NotebookPen,
  Wallet,
  PiggyBank,
  Repeat,
  ChevronRight,
  Sparkles,
  Merge,
  Home,
  ShieldCheck,
  Pencil,
  DatabaseBackup,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useHousehold } from "@/lib/context/household-context";
import { createClient } from "@/lib/supabase/client";
import { renameHousehold } from "@/lib/actions/household";
import { exportHouseholdBackup } from "@/lib/actions/reports";

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
  const { householdName, inviteCode, displayName, avatarUrl, partner, isOwner } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(householdName);
  const [savingName, setSavingName] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  async function downloadBackup() {
    setBackingUp(true);
    const result = await exportHouseholdBackup();
    setBackingUp(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gharkharch-backup-${result.data.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied");
  }

  function openRename() {
    setNameDraft(householdName);
    setRenaming(true);
  }

  async function saveRename() {
    if (!nameDraft.trim() || nameDraft.trim() === householdName) {
      setRenaming(false);
      return;
    }
    setSavingName(true);
    const result = await renameHousehold(nameDraft.trim());
    setSavingName(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Household renamed");
    setRenaming(false);
    router.refresh();
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
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename()}
                  autoFocus
                  className="h-9"
                  maxLength={60}
                />
                <Button size="sm" loading={savingName} onClick={saveRename}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRenaming(false)} disabled={savingName}>
                  Cancel
                </Button>
              </div>
            ) : (
              <CardTitle className="flex items-center gap-2">
                {householdName}
                {isOwner && (
                  <button onClick={openRename} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-primary" aria-label="Rename household">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </CardTitle>
            )}
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
            <MenuLink href="/more/budgets" icon={PiggyBank} label="Budgets" />
            <MenuLink href="/more/recurring" icon={Repeat} label="Recurring expenses" />
            <MenuLink href="/more/rules" icon={Zap} label="Smart Rules (auto-fill)" />
            <MenuLink href="/more/scratchpad" icon={NotebookPen} label="Fast Scratchpad" />
          </CardContent>
        </Card>
      </div>

      {/* Data & Privacy section: full backup + CSV import, kept separate from
          Reports (which only ever exports the currently-selected date range)
          so "give me everything" and "add things in bulk" have one clear home. */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={DatabaseBackup}>Data & privacy</SectionLabel>
        <Card>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            <button onClick={downloadBackup} disabled={backingUp} className="flex items-center gap-3 px-5 py-4 text-left disabled:opacity-60">
              <DatabaseBackup className="h-4 w-4 text-brand-primary" />
              <span className="text-sm font-medium text-foreground">{backingUp ? "Preparing backup…" : "Backup my data"}</span>
            </button>
            <MenuLink href="/more/import" icon={UploadCloud} label="Import expenses from CSV" />
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
