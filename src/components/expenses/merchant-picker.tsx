"use client";

import { useState, useMemo } from "react";
import { Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { createMerchant } from "@/lib/actions/merchants";
import type { Tables } from "@/types/database";

export function MerchantPickerView({
  merchants,
  loading = false,
  onSelect,
  onMerchantCreated,
  onBack: _onBack,
}: {
  merchants: Tables<"merchants">[];
  /** True while the merchant list is still being fetched in the background (spec: avoid showing a false "no merchants" message before the fetch has had a chance to resolve). */
  loading?: boolean;
  onSelect: (merchant: Tables<"merchants">) => void;
  onMerchantCreated: (merchant: Tables<"merchants">) => void;
  onBack?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) => m.name.toLowerCase().includes(q) || m.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [merchants, query]);

  const exactMatch = merchants.some((m) => m.name.toLowerCase() === query.trim().toLowerCase());

  function pick(m: Tables<"merchants">) {
    onSelect(m);
    setQuery("");
  }

  async function handleCreate() {
    if (!query.trim()) return;
    setSaving(true);
    const result = await createMerchant({ name: query.trim(), merchant_type: "other", channel: "offline" });
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${result.data.name}" added as a merchant`);
    onMerchantCreated(result.data);
    pick(result.data);
  }

  return (
    <div className="flex h-full max-h-[80dvh] flex-col">
      <Command className="flex flex-1 flex-col overflow-hidden" shouldFilter={false}>
        <CommandInput placeholder="Search merchants…" value={query} onValueChange={setQuery} autoFocus />
        <CommandList className="flex-1 overflow-y-auto">
          {filtered.length === 0 && loading && merchants.length === 0 && !query.trim() && (
            <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading merchants…</span>
            </div>
          )}
          {filtered.length === 0 && (!loading || query.trim() || merchants.length > 0) && (
            <CommandEmpty>
              {query.trim() ? `No merchants match "${query}".` : "No merchants added yet."}
            </CommandEmpty>
          )}
          <CommandGroup>
            {filtered.map((m) => (
              <CommandItem key={m.id} value={m.name} onSelect={() => pick(m)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Store className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="font-medium text-foreground">{m.name}</span>
                {m.is_system && <span className="ml-auto text-[11px] text-muted-foreground">Suggested</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        {query.trim() && !exactMatch && (
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Adding…" : `Create "${query.trim()}" as a new merchant`}
            </button>
          </div>
        )}
      </Command>
    </div>
  );
}

export function MerchantPicker({
  open,
  onOpenChange,
  merchants,
  loading = false,
  onSelect,
  onMerchantCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchants: Tables<"merchants">[];
  loading?: boolean;
  onSelect: (merchant: Tables<"merchants">) => void;
  onMerchantCreated: (merchant: Tables<"merchants">) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader>
          <DrawerTitle>Choose a merchant</DrawerTitle>
          <DrawerDescription>Search or add a new shop, app, or vendor.</DrawerDescription>
        </DrawerHeader>
        <MerchantPickerView
          merchants={merchants}
          loading={loading}
          onSelect={(m) => {
            onSelect(m);
            onOpenChange(false);
          }}
          onMerchantCreated={onMerchantCreated}
          onBack={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
