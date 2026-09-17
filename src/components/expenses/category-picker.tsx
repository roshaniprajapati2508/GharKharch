"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryIcon, ICON_PICKER_OPTIONS, COLOR_PICKER_OPTIONS, colorSwatch } from "@/lib/icon-map";
import { createCategory } from "@/lib/actions/categories";
import type { CategoryWithChildren } from "@/lib/actions/categories";
import { cn } from "@/lib/utils";

export interface CategorySelection {
  categoryId: string;
  subcategoryId: string | null;
  categoryName: string;
  subcategoryName: string | null;
}

export function CategoryPickerView({
  tree,
  onSelect,
  onCategoryCreated,
  onBack,
}: {
  tree: CategoryWithChildren[];
  onSelect: (selection: CategorySelection) => void;
  onCategoryCreated: (category: CategoryWithChildren) => void;
  onBack?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("circle");
  const [newColor, setNewColor] = useState("neutral");
  const [saving, setSaving] = useState(false);

  function pick(cat: CategoryWithChildren, sub?: CategoryWithChildren["children"][number]) {
    onSelect({
      categoryId: cat.id,
      subcategoryId: sub?.id ?? null,
      categoryName: cat.name,
      subcategoryName: sub?.name ?? null,
    });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const result = await createCategory({ name: newName.trim(), icon: newIcon, color: newColor, parent_id: null, sort_order: 999 });
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${result.data.name}" added`);
    onCategoryCreated({ ...result.data, children: [] });
    pick({ ...result.data, children: [] });
    setCreating(false);
    setNewName("");
  }

  return (
    <div className="flex h-full max-h-[80vh] flex-col">
      {!creating ? (
        <Command className="flex flex-1 flex-col overflow-hidden" shouldFilter={true}>
          <CommandInput placeholder="Search categories…" autoFocus />
          <CommandList className="flex-1 overflow-y-auto">
            <CommandEmpty>No categories match.</CommandEmpty>
            {tree.map((cat) => (
              <CommandGroup key={cat.id} heading={cat.name}>
                <CommandItem value={cat.name} onSelect={() => pick(cat)}>
                  <CategoryIcon icon={cat.icon} color={cat.color} />
                  <span className="font-medium">{cat.name} (general)</span>
                </CommandItem>
                {cat.children.map((sub) => (
                  <CommandItem key={sub.id} value={`${cat.name} ${sub.name}`} onSelect={() => pick(cat, sub)}>
                    <CategoryIcon icon={sub.icon} color={cat.color} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" />
                    {sub.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="border-t border-border p-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Add a new category
            </Button>
          </div>
        </Command>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2">
          <div>
            <Label htmlFor="new-category-name">Category name</Label>
            <Input id="new-category-name" value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1.5" autoFocus />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {ICON_PICKER_OPTIONS.slice(0, 18).map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewIcon(icon)}
                  className={cn("rounded-lg p-1", newIcon === icon && "ring-2 ring-primary")}
                >
                  <CategoryIcon icon={icon} color={newColor} className="flex h-9 w-9 items-center justify-center rounded-lg" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {COLOR_PICKER_OPTIONS.map((color) => {
                const swatch = colorSwatch(color);
                const active = newColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    style={{ backgroundColor: swatch.bg }}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-full", active && "ring-2 ring-primary ring-offset-2")}
                  >
                    {active && <Check className="h-4 w-4" style={{ color: swatch.fg }} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving ? "Saving…" : "Save category"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryPicker({
  open,
  onOpenChange,
  tree,
  onSelect,
  onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: CategoryWithChildren[];
  onSelect: (selection: CategorySelection) => void;
  onCategoryCreated: (category: CategoryWithChildren) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Choose a category</DrawerTitle>
          <DrawerDescription>Global defaults plus anything you&apos;ve added.</DrawerDescription>
        </DrawerHeader>
        <CategoryPickerView
          tree={tree}
          onSelect={(selection) => {
            onSelect(selection);
            onOpenChange(false);
          }}
          onCategoryCreated={onCategoryCreated}
          onBack={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
