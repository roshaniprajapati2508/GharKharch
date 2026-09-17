"use client";

import { useRef, useState } from "react";
import { Pencil, Copy, Trash2, MessageSquarePlus, MoreVertical } from "lucide-react";
import { CategoryIcon } from "@/lib/icon-map";
import { formatINR, cn } from "@/lib/utils";
import { formatExpenseTime } from "@/lib/date-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { EnrichedExpense } from "@/lib/actions/expenses";

const SWIPE_REVEAL = 152;

export function ExpenseRow({
  expense,
  onEdit,
  onDuplicate,
  onDelete,
  onAddNote,
}: {
  expense: EnrichedExpense;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddNote: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    setDragX(Math.max(-SWIPE_REVEAL, Math.min(0, delta)));
  }

  function onPointerUp() {
    dragging.current = false;
    setDragX((x) => (x < -SWIPE_REVEAL / 2 ? -SWIPE_REVEAL : 0));
  }

  const timeLabel = formatExpenseTime(expense.expense_time, expense.created_at);

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex items-stretch">
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
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${dragX}px)`, touchAction: "pan-y" }}
        className={cn("relative flex items-center gap-3 bg-card px-1 py-2.5 transition-transform", dragX === 0 && "duration-200")}
      >
        <CategoryIcon icon={expense.category_icon} color={expense.category_color} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{expense.merchant_name ?? expense.item_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {expense.category_name ?? "Uncategorized"}
            {expense.subcategory_name ? ` › ${expense.subcategory_name}` : ""} · {expense.payer_name}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <p className="text-sm font-semibold text-foreground">{formatINR(expense.amount)}</p>
          <DropdownMenu>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
