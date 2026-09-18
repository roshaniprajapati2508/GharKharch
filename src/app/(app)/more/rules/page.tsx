"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Trash2, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { listAutomationRules, createAutomationRule, updateAutomationRule, toggleAutomationRule, deleteAutomationRule } from "@/lib/actions/automation-rules";
import { listCategoriesForHousehold, type CategoryWithChildren } from "@/lib/actions/categories";
import { listMerchantsForHousehold } from "@/lib/actions/merchants";
import { useHousehold } from "@/lib/context/household-context";
import type { AutomationRule } from "@/lib/expense-intelligence/automation-rules";
import type { Tables } from "@/types/database";

type RuleFormState = {
  name: string;
  priority: number;
  keywords: string[];
  keywordDraft: string;
  entryType: "" | "expense" | "income";
  categoryName: string;
  subcategoryName: string;
  merchantName: string;
  paymentMethod: string;
  paidByName: string;
};

function emptyForm(): RuleFormState {
  return {
    name: "",
    priority: 50,
    keywords: [],
    keywordDraft: "",
    entryType: "",
    categoryName: "",
    subcategoryName: "",
    merchantName: "",
    paymentMethod: "",
    paidByName: "",
  };
}

function ruleToForm(rule: AutomationRule): RuleFormState {
  return {
    name: rule.name,
    priority: rule.priority,
    keywords: rule.conditions.keywords ?? [],
    keywordDraft: "",
    entryType: rule.conditions.entry_type ?? "",
    categoryName: rule.actions.category_name ?? "",
    subcategoryName: rule.actions.subcategory_name ?? "",
    merchantName: rule.actions.merchant_name ?? "",
    paymentMethod: rule.actions.payment_method ?? "",
    paidByName: rule.actions.paid_by_name ?? "",
  };
}

/**
 * IFTTT-style Smart Rules manager (spec: Module 1 - Developer
 * Implementation Brief). Lists global default rules (toggle-only - a
 * household can turn a default off but not edit/delete the shared row,
 * same affordance as global categories/merchants) alongside the
 * household's own rules (full edit/delete), and a drawer to build a new
 * one: "When item contains [keywords] -> set [category/merchant/paid
 * by/payment method]".
 */
export default function AutomationRulesPage() {
  const { displayName, partner } = useHousehold();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);
  const [merchants, setMerchants] = useState<Tables<"merchants">[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const paidByOptions = [displayName, partner?.displayName].filter(Boolean) as string[];

  async function load() {
    const [rulesResult, catResult, merchResult] = await Promise.all([
      listAutomationRules(),
      listCategoriesForHousehold(),
      listMerchantsForHousehold(),
    ]);
    if (rulesResult.data) setRules(rulesResult.data);
    if (catResult.data) setCategoryTree(catResult.data.tree);
    if (merchResult.data) setMerchants(merchResult.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const globalRules = useMemo(() => rules.filter((r) => r.household_id === null), [rules]);
  const myRules = useMemo(() => rules.filter((r) => r.household_id !== null), [rules]);

  const selectedCategory = categoryTree.find((c) => c.name === form.categoryName) ?? null;

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setEditorOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditTarget(rule);
    setForm(ruleToForm(rule));
    setEditorOpen(true);
  }

  function addKeyword() {
    const kw = form.keywordDraft.trim().toLowerCase();
    if (!kw || form.keywords.includes(kw)) {
      setForm((f) => ({ ...f, keywordDraft: "" }));
      return;
    }
    setForm((f) => ({ ...f, keywords: [...f.keywords, kw], keywordDraft: "" }));
  }

  function removeKeyword(kw: string) {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }));
  }

  async function handleToggle(rule: AutomationRule, isActive: boolean) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: isActive } : r)));
    const result = await toggleAutomationRule(rule.id, isActive);
    if (result.error !== null) {
      toast.error(result.error);
      load();
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Give this rule a name");
      return;
    }
    if (form.keywords.length === 0) {
      toast.error("Add at least one trigger keyword");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      priority: form.priority,
      is_active: true,
      conditions: {
        keywords: form.keywords,
        min_amount: null,
        max_amount: null,
        entry_type: form.entryType || null,
        time_of_day: null,
      },
      actions: {
        category_name: form.categoryName || null,
        subcategory_name: form.subcategoryName || null,
        merchant_name: form.merchantName || null,
        payment_method: form.paymentMethod || null,
        paid_by_name: form.paidByName || null,
        entry_type: form.entryType || null,
      },
    };
    const result = editTarget ? await updateAutomationRule(editTarget.id, payload) : await createAutomationRule(payload);
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(editTarget ? "Rule updated" : "Rule created");
    setEditorOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteAutomationRule(deleteTarget.id);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success("Rule deleted");
    setDeleteTarget(null);
    load();
  }

  function RuleRow({ rule, editable }: { rule: AutomationRule; editable: boolean }) {
    const summary = [
      rule.actions.entry_type === "income" ? "Type: Income" : null,
      rule.actions.category_name ? `Category: ${rule.actions.category_name}${rule.actions.subcategory_name ? ` > ${rule.actions.subcategory_name}` : ""}` : null,
      rule.actions.merchant_name ? `Merchant: ${rule.actions.merchant_name}` : null,
      rule.actions.paid_by_name ? `${rule.actions.entry_type === "income" ? "Received by" : "Paid by"}: ${rule.actions.paid_by_name}` : null,
      rule.actions.payment_method ? `Payment: ${rule.actions.payment_method}` : null,
    ].filter(Boolean);

    return (
      <div className="rounded-xl border border-border/60 bg-card/90 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{rule.name}</p>
            <p className="mt-1 flex flex-wrap gap-1">
              {rule.conditions.keywords.map((kw) => (
                <span key={kw} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {kw}
                </span>
              ))}
            </p>
            {summary.length > 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">{summary.join(" · ")}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Switch checked={rule.is_active} onCheckedChange={(v) => handleToggle(rule, v)} aria-label={`Toggle ${rule.name}`} />
            {editable && (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(rule)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeleteTarget(rule)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" prefetch={true} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Zap className="h-4.5 w-4.5" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Smart Rules</h1>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> New Rule
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        When something you type or say matches a rule&apos;s keywords, Add Expense auto-fills its category, merchant, paid-by and payment method - look
        for the <span className="font-medium text-violet-600 dark:text-violet-400">✨ Auto-filled by rule</span> badge.
      </p>

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton-shimmer h-16 rounded-xl bg-muted" />
          <div className="skeleton-shimmer h-16 rounded-xl bg-muted" />
        </div>
      ) : (
        <>
          {myRules.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Your Rules</h2>
              <div className="space-y-2">
                {myRules.map((r) => (
                  <RuleRow key={r.id} rule={r} editable />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Default Rules</h2>
            <div className="space-y-2">
              {globalRules.map((r) => (
                <RuleRow key={r.id} rule={r} editable={false} />
              ))}
            </div>
          </div>
        </>
      )}

      <Drawer open={editorOpen} onOpenChange={setEditorOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>{editTarget ? "Edit Rule" : "New Smart Rule"}</DrawerTitle>
            <DrawerDescription>When an item contains any of these keywords, auto-fill the fields below.</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div>
              <Label htmlFor="rule-name">Rule name</Label>
              <Input id="rule-name" className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Xerox & Book Stock" />
            </div>

            <div>
              <Label htmlFor="rule-keyword">Trigger keywords</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="rule-keyword"
                  value={form.keywordDraft}
                  onChange={(e) => setForm((f) => ({ ...f, keywordDraft: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Type a keyword and press Enter"
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  Add
                </Button>
              </div>
              {form.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.keywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-background">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="rule-type">Entry type</Label>
              <select
                id="rule-type"
                value={form.entryType}
                onChange={(e) => setForm((f) => ({ ...f, entryType: e.target.value as RuleFormState["entryType"] }))}
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
              >
                <option value="">Don&apos;t change</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rule-category">Category</Label>
                <select
                  id="rule-category"
                  value={form.categoryName}
                  onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value, subcategoryName: "" }))}
                  className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
                >
                  <option value="">Don&apos;t change</option>
                  {categoryTree.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="rule-subcategory">Subcategory</Label>
                <select
                  id="rule-subcategory"
                  value={form.subcategoryName}
                  onChange={(e) => setForm((f) => ({ ...f, subcategoryName: e.target.value }))}
                  disabled={!selectedCategory}
                  className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm disabled:opacity-50"
                >
                  <option value="">None</option>
                  {selectedCategory?.children.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="rule-merchant">Merchant</Label>
              <select
                id="rule-merchant"
                value={form.merchantName}
                onChange={(e) => setForm((f) => ({ ...f, merchantName: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
              >
                <option value="">Don&apos;t change</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rule-paidby">{form.entryType === "income" ? "Received by" : "Paid by"}</Label>
                <select
                  id="rule-paidby"
                  value={form.paidByName}
                  onChange={(e) => setForm((f) => ({ ...f, paidByName: e.target.value }))}
                  className="mt-1.5 h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
                >
                  <option value="">Don&apos;t change</option>
                  {paidByOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="rule-payment">Payment method</Label>
                <Input
                  id="rule-payment"
                  className="mt-1.5"
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  placeholder="e.g. UPI"
                />
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Rule"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this rule?"
        description={`"${deleteTarget?.name}" will stop auto-filling expenses. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
