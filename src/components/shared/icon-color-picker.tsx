"use client";

// Compact icon + color picker for categories/merchants. Replaces the old
// always-expanded grid (which, once the icon set grew past ~70 options,
// pushed the rest of the create/edit sheet off-screen and made "Save" hard
// to reach) with a small trigger that opens a popover: a search box to
// filter ~140 icons by name, a single-row color swatch strip, and a
// height-capped, scrollable icon grid. Only the picker itself takes space
// on screen; the surrounding form stays put.

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CategoryIcon, ICON_PICKER_OPTIONS, COLOR_PICKER_OPTIONS, colorSwatch } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

export function IconColorPicker({
  icon,
  color,
  onIconChange,
  onColorChange,
}: {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredIcons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_PICKER_OPTIONS;
    return ICON_PICKER_OPTIONS.filter((i) => i.replace(/-/g, " ").includes(q));
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          <CategoryIcon icon={icon} color={color} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" />
          <span className="text-muted-foreground">Icon &amp; color</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-3" align="start">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Color</p>
            <div className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
              {COLOR_PICKER_OPTIONS.map((c) => {
                const swatch = colorSwatch(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onColorChange(c)}
                    style={{ backgroundColor: swatch.bg }}
                    className={cn("h-7 w-7 shrink-0 rounded-full", color === c && "ring-2 ring-primary ring-offset-1")}
                    aria-label={c}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Icon</p>
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search icons…" className="h-8 pl-8 text-xs" />
            </div>
            <div className="grid max-h-40 grid-cols-7 gap-1 overflow-y-auto">
              {filteredIcons.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onIconChange(i)}
                  className={cn("rounded-lg p-0.5", icon === i && "ring-2 ring-primary")}
                  aria-label={i}
                >
                  <CategoryIcon icon={i} color={color} className="flex h-8 w-8 items-center justify-center rounded-lg" />
                </button>
              ))}
              {filteredIcons.length === 0 && <p className="col-span-7 py-4 text-center text-xs text-muted-foreground">No icons match.</p>}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
