"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Store, Trash2, Search, X, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  listMerchantsForHousehold,
  createMerchant,
  updateMerchant,
  customizeMerchant,
  hideGlobalMerchant,
  deactivateMerchant,
  addMerchantAlias,
  removeMerchantAlias,
  setMerchantParent,
} from "@/lib/actions/merchants";
import type { Tables } from "@/types/database";

export default function MerchantsSettingsPage() {
  const [merchants, setMerchants] = useState<Tables<"merchants">[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tables<"merchants"> | null>(null);
  const [detailTarget, setDetailTarget] = useState<Tables<"merchants"> | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [aliasBusy, setAliasBusy] = useState(false);
  const [parentBusy, setParentBusy] = useState(false);
  const [nameEdit, setNameEdit] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [customizeTarget, setCustomizeTarget] = useState<Tables<"merchants"> | null>(null);
  const [customizeName, setCustomizeName] = useState("");
  const [customizeSaving, setCustomizeSaving] = useState(false);
  const [hideTarget, setHideTarget] = useState<Tables<"merchants"> | null>(null);
  const [hiding, setHiding] = useState(false);

  async function load() {
    setLoading(true);
    const result = await listMerchantsForHousehold();
    if (result.data) setMerchants(result.data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter((m) => m.name.toLowerCase().includes(q) || (m.aliases ?? []).some((a) => a.includes(q)));
  }, [merchants, query]);

  // Keeps the open detail drawer's data fresh after an alias/parent change.
  const liveDetailTarget = detailTarget ? merchants.find((m) => m.id === detailTarget.id) ?? detailTarget : null;

  const parentOptions = merchants.filter((m) => m.household_id && m.id !== detailTarget?.id && m.parent_merchant_id === null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const result = await createMerchant({ name: newName.trim(), merchant_type: "other", channel: "offline" });
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${result.data.name}" added`);
    setNewName("");
    load();
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    const result = await deactivateMerchant(deleteTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Merchant removed");
    load();
  }

  async function handleAddAlias() {
    if (!liveDetailTarget || !aliasInput.trim()) return;
    setAliasBusy(true);
    const result = await addMerchantAlias(liveDetailTarget.id, aliasInput.trim());
    setAliasBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setAliasInput("");
    toast.success(`"${aliasInput.trim()}" added as an alias`);
    load();
  }

  async function handleRemoveAlias(alias: string) {
    if (!liveDetailTarget) return;
    setAliasBusy(true);
    const result = await removeMerchantAlias(liveDetailTarget.id, alias);
    setAliasBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${alias}" removed`);
    load();
  }

  async function handleRename() {
    if (!liveDetailTarget || !nameEdit.trim() || nameEdit.trim() === liveDetailTarget.name) return;
    setNameBusy(true);
    const result = await updateMerchant(liveDetailTarget.id, { name: nameEdit.trim() });
    setNameBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Merchant renamed");
    load();
  }

  async function handleCustomizeSave() {
    if (!customizeTarget || !customizeName.trim()) return;
    setCustomizeSaving(true);
    const result = await customizeMerchant(customizeTarget.id, { name: customizeName.trim() });
    setCustomizeSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${result.data.name}" is now yours to edit`);
    setCustomizeTarget(null);
    load();
  }

  async function handleHideGlobal() {
    if (!hideTarget) return;
    setHiding(true);
    const result = await hideGlobalMerchant(hideTarget.id);
    setHiding(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${hideTarget.name}" removed from your merchants`);
    setHideTarget(null);
    load();
  }

  async function handleSetParent(parentId: string | null) {
    if (!liveDetailTarget) return;
    setParentBusy(true);
    const result = await setMerchantParent(liveDetailTarget.id, parentId);
    setParentBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(parentId ? "Grouped under parent merchant" : "Ungrouped");
    load();
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Merchants</h1>
      </div>

      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New merchant name…" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
        <Button onClick={handleCreate} loading={saving} disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchants or aliases…" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {filtered.map((m) => (
            <div key={m.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
              <button
                onClick={() => {
                  if (m.household_id) {
                    setDetailTarget(m);
                    setNameEdit(m.name);
                  }
                }}
                disabled={!m.household_id}
                className="flex min-w-0 flex-1 items-center gap-3 disabled:cursor-default"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Store className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                    {m.parent_merchant_id && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        grouped
                      </Badge>
                    )}
                  </div>
                  {m.aliases && m.aliases.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">aka {m.aliases.join(", ")}</p>
                  )}
                </div>
              </button>
              {m.is_system && (
                <Badge variant="outline" className="shrink-0">
                  Suggested
                </Badge>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {!m.household_id && (
                  <button
                    onClick={() => {
                      setCustomizeTarget(m);
                      setCustomizeName(m.name);
                    }}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => (m.household_id ? setDeleteTarget(m) : setHideTarget(m))}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  title={m.household_id ? "Remove" : "Remove from my merchants"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No merchants match.</p>}
        </div>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove "${deleteTarget?.name}"?`}
        description="You can always add it again later. Past expenses keep this merchant's name."
        confirmLabel="Remove"
        onConfirm={handleDeactivate}
      />

      <Drawer
        open={!!detailTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
            setAliasInput("");
            setNameEdit("");
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-brand-primary" />
              {liveDetailTarget?.name}
            </DrawerTitle>
            <DrawerDescription>Rename, add aliases, and group this merchant (spec item 44) — teach GharKharch other names it goes by.</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-5 overflow-y-auto px-5 pb-2">
            <div>
              <Label className="text-xs">Name</Label>
              <div className="mt-2 flex gap-2">
                <Input value={nameEdit} onChange={(e) => setNameEdit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRename()} />
                <Button
                  variant="outline"
                  loading={nameBusy}
                  disabled={!nameEdit.trim() || nameEdit.trim() === liveDetailTarget?.name}
                  onClick={handleRename}
                >
                  Save
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Aliases</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(liveDetailTarget?.aliases ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No aliases yet — add one below.</p>
                )}
                {(liveDetailTarget?.aliases ?? []).map((alias) => (
                  <span
                    key={alias}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                  >
                    {alias}
                    <button onClick={() => handleRemoveAlias(alias)} disabled={aliasBusy} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2.5 flex gap-2">
                <Input
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="e.g. instamart"
                  onKeyDown={(e) => e.key === "Enter" && handleAddAlias()}
                />
                <Button onClick={handleAddAlias} loading={aliasBusy} disabled={!aliasInput.trim()}>
                  Add
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Parent merchant</Label>
              <p className="mt-1 text-xs text-muted-foreground">Group this under another merchant (e.g. &quot;Swiggy Instamart&quot; under &quot;Swiggy&quot;).</p>
              <select
                value={liveDetailTarget?.parent_merchant_id ?? ""}
                onChange={(e) => handleSetParent(e.target.value || null)}
                disabled={parentBusy}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">No parent — standalone merchant</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DrawerFooter>
            <Button variant="outline" onClick={() => setDetailTarget(null)}>
              Done
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {customizeTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setCustomizeTarget(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold text-foreground">Customize this merchant</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              This is a shared/system merchant, so saving creates your own editable copy and removes the original from your list — nothing changes for anyone else. Once saved, you can add aliases and grouping on your copy same as any merchant you add yourself.
            </p>
            <Label>Name</Label>
            <Input value={customizeName} onChange={(e) => setCustomizeName(e.target.value)} className="mt-1.5" autoFocus onKeyDown={(e) => e.key === "Enter" && handleCustomizeSave()} />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCustomizeTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={customizeSaving} disabled={!customizeName.trim()} onClick={handleCustomizeSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!hideTarget}
        onOpenChange={(open) => !open && setHideTarget(null)}
        title={`Remove "${hideTarget?.name}" from your merchants?`}
        description="This only affects your household — it stays available to everyone else, and any past expenses using it keep it."
        confirmLabel="Remove"
        destructive
        onConfirm={handleHideGlobal}
        confirmDisabled={hiding}
      />
    </div>
  );
}
