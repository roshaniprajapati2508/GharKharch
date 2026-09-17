"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Plus, Pencil, Trash2, CreditCard, Landmark, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { getIcon } from "@/lib/icon-map";
import { listPaymentMethodsForHousehold, createPaymentMethod, updatePaymentMethod, deactivatePaymentMethod } from "@/lib/actions/payment-methods";
import {
  listUserCards,
  createUserCard,
  updateUserCard,
  deactivateUserCard,
  listUpiProfiles,
  createUpiProfile,
  updateUpiProfile,
  deactivateUpiProfile,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deactivateBankAccount,
  listCardCatalogue,
} from "@/lib/actions/payment-instruments";
import type { Tables } from "@/types/database";

// Shared enter/exit for every list row below (add/edit/remove should read as
// a visible change, not an instant re-render) - framer-motion's global
// `MotionConfig reducedMotion="user"` in app-shell.tsx already collapses
// this to an instant snap under prefers-reduced-motion.
const ROW_MOTION = {
  layout: true as const,
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

export default function PaymentMethodsSettingsPage() {
  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Payment methods</h1>
      </div>

      <Tabs defaultValue="methods">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="upi">UPI</TabsTrigger>
          <TabsTrigger value="banks">Banks</TabsTrigger>
        </TabsList>
        <TabsContent value="methods">
          <MethodsTab />
        </TabsContent>
        <TabsContent value="cards">
          <CardsTab />
        </TabsContent>
        <TabsContent value="upi">
          <UpiTab />
        </TabsContent>
        <TabsContent value="banks">
          <BanksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MethodsTab() {
  const [methods, setMethods] = useState<Tables<"payment_methods">[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Tables<"payment_methods"> | null>(null);
  const [editTarget, setEditTarget] = useState<Tables<"payment_methods"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    const result = await listPaymentMethodsForHousehold();
    if (result.data) setMethods(result.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    const result = await createPaymentMethod({ name: name.trim(), icon: "wallet" });
    setSaving(false);
    if (result.error !== null) return toast.error(result.error);
    toast.success(`"${result.data.name}" added`);
    setName("");
    load();
  }

  async function saveRename() {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true);
    const result = await updatePaymentMethod(editTarget.id, { name: editName.trim() });
    setEditSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Renamed to "${result.data.name}"`);
    setEditTarget(null);
    load();
  }

  async function remove() {
    if (!removeTarget) return;
    const result = await deactivatePaymentMethod(removeTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${removeTarget.name}" removed`);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amex, Gift Card" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} loading={saving} disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        <AnimatePresence initial={false}>
        {methods.map((m) => {
          const Icon = getIcon(m.icon);
          return (
            <motion.div key={m.id} {...ROW_MOTION} className="flex items-center gap-3 overflow-hidden px-3 py-2.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{m.name}</span>
              {m.is_default && <span className="ml-2 text-[11px] text-muted-foreground">Default</span>}
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  onClick={() => {
                    setEditTarget(m);
                    setEditName(m.name);
                  }}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                  aria-label="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!m.is_default && (
                  <button onClick={() => setRemoveTarget(m)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove "${removeTarget?.name}"?`}
        description="You can add it again later - past expenses keep this payment method's name."
        confirmLabel="Remove"
        onConfirm={remove}
      />

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setEditTarget(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Rename payment method</h2>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && saveRename()} />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={editSaving} disabled={!editName.trim()} onClick={saveRename}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_CARD_FORM = { custom_name: "", issuer_id: "", last4: "", card_type: "credit" as "credit" | "debit" | "prepaid" };

function CardsTab() {
  const [cards, setCards] = useState<Tables<"user_cards">[]>([]);
  const [issuers, setIssuers] = useState<Tables<"card_issuers">[]>([]);
  const [form, setForm] = useState(EMPTY_CARD_FORM);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Tables<"user_cards"> | null>(null);

  async function load() {
    const [cardsResult, catalogueResult] = await Promise.all([listUserCards(), listCardCatalogue()]);
    if (cardsResult.data) setCards(cardsResult.data);
    if (catalogueResult.data) setIssuers(catalogueResult.data.issuers);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, []);

  function openEdit(c: Tables<"user_cards">) {
    setEditingId(c.id);
    setForm({ custom_name: c.custom_name, issuer_id: c.issuer_id ?? "", last4: c.last4 ?? "", card_type: c.card_type as typeof form.card_type });
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_CARD_FORM);
  }

  async function save() {
    if (!form.custom_name.trim()) return;
    setSaving(true);
    const payload = { custom_name: form.custom_name.trim(), issuer_id: form.issuer_id || null, last4: form.last4 || null, card_type: form.card_type };
    const result = editingId ? await updateUserCard(editingId, payload) : await createUserCard(payload);
    setSaving(false);
    if (result.error !== null) return toast.error(result.error);
    toast.success(editingId ? "Card updated" : "Card added");
    closeForm();
    load();
  }

  async function remove() {
    if (!removeTarget) return;
    const result = await deactivateUserCard(removeTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${removeTarget.custom_name}" removed`);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        GharKharch only stores the card name, issuer, network, and last 4 digits for spend tracking - never a full card number, CVV, or PIN.
      </p>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        <AnimatePresence initial={false}>
        {cards.map((c) => (
          <motion.div key={c.id} {...ROW_MOTION} className="flex items-center gap-3 overflow-hidden px-3 py-2.5">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {c.custom_name}
              {c.last4 ? ` •••• ${c.last4}` : ""}
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <button onClick={() => openEdit(c)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" aria-label="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setRemoveTarget(c)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
        {cards.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No cards added yet.</p>}
      </div>

      {!adding ? (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add a card
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div>
            <Label>Name</Label>
            <Input value={form.custom_name} onChange={(e) => setForm({ ...form, custom_name: e.target.value })} placeholder="e.g. HDFC Regalia" className="mt-1.5" />
          </div>
          <div>
            <Label>Issuer</Label>
            <select
              value={form.issuer_id}
              onChange={(e) => setForm({ ...form, issuer_id: e.target.value })}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
            >
              <option value="">Not specified</option>
              {issuers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Last 4 digits</Label>
              <Input value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value })} maxLength={4} className="mt-1.5" />
            </div>
            <div>
              <Label>Type</Label>
              <select
                value={form.card_type}
                onChange={(e) => setForm({ ...form, card_type: e.target.value as typeof form.card_type })}
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
                <option value="prepaid">Prepaid</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={closeForm}>
              Cancel
            </Button>
            <Button className="flex-1" loading={saving} disabled={!form.custom_name.trim()} onClick={save}>
              {editingId ? "Save changes" : "Save card"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove "${removeTarget?.custom_name}"?`}
        description="You can add it again later - past expenses keep this card's name."
        confirmLabel="Remove"
        onConfirm={remove}
      />
    </div>
  );
}

function UpiTab() {
  const [profiles, setProfiles] = useState<Tables<"upi_profiles">[]>([]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Tables<"upi_profiles"> | null>(null);
  const [editTarget, setEditTarget] = useState<Tables<"upi_profiles"> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    const result = await listUpiProfiles();
    if (result.data) setProfiles(result.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, []);

  async function add() {
    if (!label.trim()) return;
    setSaving(true);
    const result = await createUpiProfile({ label: label.trim(), upi_app: "other" });
    setSaving(false);
    if (result.error !== null) return toast.error(result.error);
    toast.success("UPI profile added");
    setLabel("");
    load();
  }

  async function saveRename() {
    if (!editTarget || !editLabel.trim()) return;
    setEditSaving(true);
    const result = await updateUpiProfile(editTarget.id, { label: editLabel.trim() });
    setEditSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Renamed to "${result.data.label}"`);
    setEditTarget(null);
    load();
  }

  async function remove() {
    if (!removeTarget) return;
    const result = await deactivateUpiProfile(removeTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${removeTarget.label}" removed`);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Just a label to tell your UPI apps apart - never a UPI PIN or any credential.</p>
      <div className="flex gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Google Pay, PhonePe" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} loading={saving} disabled={!label.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        <AnimatePresence initial={false}>
        {profiles.map((p) => (
          <motion.div key={p.id} {...ROW_MOTION} className="flex items-center gap-3 overflow-hidden px-3 py-2.5">
            <QrCode className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{p.label}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => {
                  setEditTarget(p);
                  setEditLabel(p.label);
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                aria-label="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setRemoveTarget(p)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
        {profiles.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No UPI profiles added yet.</p>}
      </div>

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove "${removeTarget?.label}"?`}
        description="You can add it again later - past expenses keep this label."
        confirmLabel="Remove"
        onConfirm={remove}
      />

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setEditTarget(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Rename UPI profile</h2>
            <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && saveRename()} />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={editSaving} disabled={!editLabel.trim()} onClick={saveRename}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BanksTab() {
  const [accounts, setAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [bankName, setBankName] = useState("");
  const [last4, setLast4] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Tables<"bank_accounts"> | null>(null);
  const [editTarget, setEditTarget] = useState<Tables<"bank_accounts"> | null>(null);
  const [editBankName, setEditBankName] = useState("");
  const [editLast4, setEditLast4] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    const result = await listBankAccounts();
    if (result.data) setAccounts(result.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time data fetch on mount
    load();
  }, []);

  async function add() {
    if (!bankName.trim()) return;
    setSaving(true);
    const result = await createBankAccount({ bank_name: bankName.trim(), account_type: "savings", account_last4: last4 || null });
    setSaving(false);
    if (result.error !== null) return toast.error(result.error);
    toast.success("Bank account added");
    setBankName("");
    setLast4("");
    load();
  }

  async function saveEdit() {
    if (!editTarget || !editBankName.trim()) return;
    setEditSaving(true);
    const result = await updateBankAccount(editTarget.id, { bank_name: editBankName.trim(), account_last4: editLast4 || null });
    setEditSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${result.data.bank_name}" updated`);
    setEditTarget(null);
    load();
  }

  async function remove() {
    if (!removeTarget) return;
    const result = await deactivateBankAccount(removeTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${removeTarget.bank_name}" removed`);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Only the last 2-4 digits are stored - never a full account number.</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
        <Input value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="XXXX" maxLength={4} className="w-20" />
      </div>
      <Button onClick={add} loading={saving} disabled={!bankName.trim()}>
        <Plus className="h-4 w-4" /> Add bank account
      </Button>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        <AnimatePresence initial={false}>
        {accounts.map((a) => (
          <motion.div key={a.id} {...ROW_MOTION} className="flex items-center gap-3 overflow-hidden px-3 py-2.5">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {a.bank_name}
              {a.account_last4 ? ` •••• ${a.account_last4}` : ""}
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => {
                  setEditTarget(a);
                  setEditBankName(a.bank_name);
                  setEditLast4(a.account_last4 ?? "");
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setRemoveTarget(a)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
        {accounts.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No bank accounts added yet.</p>}
      </div>

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove "${removeTarget?.bank_name}"?`}
        description="You can add it again later - past expenses keep this bank account's name."
        confirmLabel="Remove"
        onConfirm={remove}
      />

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setEditTarget(null)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Edit bank account</h2>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input value={editBankName} onChange={(e) => setEditBankName(e.target.value)} placeholder="Bank name" autoFocus />
              <Input value={editLast4} onChange={(e) => setEditLast4(e.target.value)} placeholder="XXXX" maxLength={4} className="w-20" />
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={editSaving} disabled={!editBankName.trim()} onClick={saveEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
