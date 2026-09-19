"use client";

import { useRef, useState } from "react";
import { Pencil, Copy, Trash2, MessageSquarePlus, MoreVertical, Repeat, Sparkles, Paperclip, Check, Tag, User, CreditCard } from "lucide-react";
import { CategoryIcon } from "@/lib/icon-map";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useHousehold } from "@/lib/context/household-context";
import type { EnrichedExpense, InlineEditableField } from "@/lib/actions/expenses";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import type { Tables } from "@/types/database";

const QUICK_PAYMENT_METHODS = ["UPI", "Cash", "Credit Card", "Bank Transfer"];

const SWIPE_REVEAL = 152;

function formatExpenseTime(expenseTime: string | null | undefined, createdAt: string | null | undefined): string | null {
  if (expenseTime && typeof expenseTime === "string") {
    const [h, m] = expenseTime.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
    }
    return expenseTime.slice(0, 5);
  }
  if (createdAt && typeof createdAt === "string") {
    try {
      const date = new Date(createdAt);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function ExpenseRow({
  expense,
  onEdit,
  onDuplicate,
  onDelete,
  onAddNote,
  onAnalyze,
  onViewReceipt,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onInlineUpdate,
  categories,
  paymentMethods,
  onPaidByChange,
}: {
  expense: EnrichedExpense;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddNote: () => void;
  onAnalyze?: () => void;
  onViewReceipt?: () => void;
  /** Multi-select mode (spec: Pillar 4 bulk actions) - swipe/tap-to-edit are disabled and a checkbox replaces the category icon. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Inline double-click-to-edit on amount/item name (spec: Pillar 4). Omit to disable inline editing for this row (e.g. the compact dashboard "recent" list). */
  onInlineUpdate?: (field: InlineEditableField, value: string) => Promise<boolean>;
  /** Desktop hover micro-action toolbar (spec: Feature 3.3). Omit any of the three to drop that quick-action from the toolbar. */
  categories?: CategoryWithChildren[];
  paymentMethods?: Tables<"payment_methods">[];
  onPaidByChange?: (userId: string, label: string) => void;
}) {
  const { userId, displayName, partner } = useHousehold();
  const payerOptions = [
    { id: userId, label: displayName },
    ...(partner ? [{ id: partner.id, label: partner.displayName }] : []),
  ];
  const showToolbar = !selectionMode && (categories || paymentMethods || onPaidByChange);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const [editingField, setEditingField] = useState<"amount" | "item_name" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  function startInlineEdit(field: "amount" | "item_name") {
    if (!onInlineUpdate || selectionMode) return;
    setEditingField(field);
    setEditValue(field === "amount" ? String(parseFloat(expense.amount)) : expense.item_name);
  }

  async function commitInlineEdit() {
    if (!editingField || !onInlineUpdate) return;
    const field = editingField;
    const value = (typeof editValue === "string" ? editValue : "").trim();
    const original = field === "amount" ? String(parseFloat(expense.amount)) : expense.item_name;
    if (!value || value === original) {
      setEditingField(null);
      return;
    }
    setSaving(true);
    const ok = await onInlineUpdate(field, value);
    setSaving(false);
    if (ok) setEditingField(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (selectionMode) return;
    startX.current = e.clientX;
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (selectionMode || !dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    setDragX(Math.max(-SWIPE_REVEAL, Math.min(0, delta)));
  }

  function onPointerUp() {
    if (selectionMode) return;
    dragging.current = false;
    setDragX((x) => (x < -SWIPE_REVEAL / 2 ? -SWIPE_REVEAL : 0));
  }

  const timeLabel = formatExpenseTime(expense.expense_time, expense.created_at);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {!selectionMode && <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={() => {
            setDragX(0);
            onEdit();
          }}
          className="flex w-[76px] items-center justify-center bg-brand-mint text-brand-primary"
          aria-label="Edit expense"
        >
          <Pencil className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            setDragX(0);
            onDelete();
          }}
          className="flex w-[76px] items-center justify-center bg-destructive/10 text-destructive"
          aria-label="Delete expense"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${dragX}px)`, touchAction: "pan-y" }}
        onClick={() => {
          if (selectionMode) onToggleSelect?.();
        }}
        tabIndex={selectionMode ? undefined : 0}
        onKeyDown={(e) => {
          if (selectionMode) return;
          const target = e.target as HTMLElement;
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
          if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement === e.currentTarget) {
            e.preventDefault();
            onDelete();
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
            e.preventDefault();
            onDuplicate();
          }
        }}
        className={cn(
          "group relative flex items-center gap-3 bg-card px-1 py-2.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          dragX === 0 && "duration-200",
          selectionMode && "cursor-pointer"
        )}
      >
        {selectionMode ? (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              selected ? "border-brand-primary bg-brand-primary text-white" : "border-border bg-card text-transparent"
            )}
          >
            <Check className="h-4 w-4" />
          </div>
        ) : (
          <CategoryIcon icon={expense.category_icon} color={expense.category_color} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {editingField === "item_name" ? (
              <input
                autoFocus
                value={editValue}
                disabled={saving}
                onChange={(e) => setEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={commitInlineEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitInlineEdit();
                  if (e.key === "Escape") setEditingField(null);
                }}
                className="min-w-0 flex-1 rounded border border-brand-primary/50 bg-background px-1.5 py-0.5 text-sm font-medium text-foreground outline-none"
              />
            ) : (
              <p
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startInlineEdit("item_name");
                }}
                className={cn("truncate text-sm font-medium text-foreground", onInlineUpdate && !selectionMode && "cursor-text")}
                title={onInlineUpdate && !selectionMode ? "Double-click to rename" : undefined}
              >
                {expense.merchant_name ?? expense.item_name}
              </p>
            )}
            {expense.entry_type === "income" && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                title="Incoming money / Income"
              >
                + Incoming
              </span>
            )}
            {expense.recurring_rule_id && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                title={expense.recurring_rule_name ? `Logged from recurring: ${expense.recurring_rule_name}` : "Logged from a recurring expense"}
              >
                <Repeat className="h-2.5 w-2.5" />
                Recurring
              </span>
            )}
            {expense.receipt_path && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewReceipt?.();
                }}
                className="flex shrink-0 items-center text-muted-foreground"
                aria-label="View receipt"
                title="Receipt attached — tap to view"
              >
                <Paperclip className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {expense.category_name ?? (expense.entry_type === "income" ? "Income" : "Uncategorized")}
            {expense.subcategory_name ? ` › ${expense.subcategory_name}` : ""} · {expense.payer_name}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {editingField === "amount" ? (
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              value={editValue}
              disabled={saving}
              onChange={(e) => setEditValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={commitInlineEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitInlineEdit();
                if (e.key === "Escape") setEditingField(null);
              }}
              className="w-20 rounded border border-brand-primary/50 bg-background px-1.5 py-0.5 text-right text-sm font-semibold text-foreground outline-none"
            />
          ) : (
            <p
              onDoubleClick={(e) => {
                e.stopPropagation();
                startInlineEdit("amount");
              }}
              className={cn(
                "text-sm font-semibold tabular-nums",
                expense.entry_type === "income"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground",
                onInlineUpdate && !selectionMode && "cursor-text"
              )}
              title={onInlineUpdate && !selectionMode ? "Double-click to edit amount" : undefined}
            >
              {expense.entry_type === "income" ? `+${formatINR(expense.amount)}` : `-${formatINR(expense.amount)}`}
            </p>
          )}

          {/* Desktop/tablet hover micro-action dock (spec: Feature 3.3) - a
              frosted-glass toolbar for non-touch pointers only, revealed on
              row hover/focus via the `group` class on the row wrapper above.
              Touch devices already have swipe-to-reveal + the "..." menu
              below, so this never renders as a second, redundant control
              surface on mobile. */}
          {showToolbar && (
            <div
              className="hidden shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-card/95 px-1 opacity-0 shadow-sm backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
              onClick={(e) => e.stopPropagation()}
            >
              {categories && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none"
                    title="Change category"
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                    {categories.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => onInlineUpdate?.("category_id", c.id)}>
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {onPaidByChange && payerOptions.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none"
                    title="Change who paid"
                  >
                    <User className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {payerOptions.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => onPaidByChange(p.id, p.label)}>
                        {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {(paymentMethods || onInlineUpdate) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none"
                    title="Change payment method"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(paymentMethods?.map((m) => m.name) ?? QUICK_PAYMENT_METHODS).map((name) => (
                      <DropdownMenuItem key={name} onClick={() => onInlineUpdate?.("payment_method", name)}>
                        {name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                type="button"
                onClick={onDuplicate}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                title="Duplicate"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {!selectionMode && <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddNote}>
                <MessageSquarePlus className="h-4 w-4" /> {expense.notes ? "Edit note" : "Add note"}
              </DropdownMenuItem>
              {onAnalyze && (
                <DropdownMenuItem onClick={onAnalyze}>
                  <Sparkles className="h-4 w-4" /> Analyze
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>
    </div>
  );
}
