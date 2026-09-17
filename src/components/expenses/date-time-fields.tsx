"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getTodayISO } from "@/lib/date-utils";

/** Native date/time pickers, tucked behind a "More options" disclosure (spec section 21: don't show every advanced field immediately). */
export function DateTimeFields({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="expense-date">Date</Label>
        <Input id="expense-date" type="date" max={getTodayISO()} value={date} onChange={(e) => onDateChange(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="expense-time">Time (optional)</Label>
        <Input id="expense-time" type="time" value={time} onChange={(e) => onTimeChange(e.target.value)} className="mt-1.5" />
      </div>
    </div>
  );
}

export function MoreOptionsDisclosure({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between px-3.5 text-sm font-medium text-foreground"
      >
        More options
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-4 border-t border-border px-3.5 py-4">{children}</div>}
    </div>
  );
}

export function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor="expense-notes">Notes (optional)</Label>
      <Textarea
        id="expense-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        rows={2}
        className="mt-1.5"
        placeholder="Add a note…"
      />
    </div>
  );
}
