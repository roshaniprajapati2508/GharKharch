"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Store, Trash2, Search, X, Tags } from "lucide-react";
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
            <button
              key={m.id}
              onClick={() => {
                if (!m.household_id) return;
                setDetailTarget(m);
                setNameEdit(m.name);
              }}
              disabled={!m.household_id}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Store className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
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
              {m.is_system ? (
                <Badge variant="outline" className="ml-auto shrink-0">
                  Suggested
                </Badge>
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(m);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      setDeleteTarget(m);
                    }
                  }}
                  className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              )}
            </button>
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
    </div>
  );
}
