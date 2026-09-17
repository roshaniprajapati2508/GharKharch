"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Trash2, Search, X, CheckSquare, Square, EyeOff, Eye, ChevronUp, ChevronDown, Merge, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { CategoryIcon, ICON_PICKER_OPTIONS, COLOR_PICKER_OPTIONS, colorSwatch } from "@/lib/icon-map";
import { cn } from "@/lib/utils";
import {
  listCategoriesForHousehold,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryUsageCount,
  reassignAndDeleteCategory,
  setCategoryActive,
  bulkDeactivateCategories,
  bulkDeleteCategories,
  reorderCategories,
  type CategoryWithChildren,
} from "@/lib/actions/categories";
import { mergeCategories } from "@/lib/actions/duplicates";
import type { Tables } from "@/types/database";

type FlatRow = Tables<"categories"> & { parentName: string | null };

/** Wraps a category/subcategory row with `@dnd-kit/sortable` drag behavior (spec item 24: true drag reorder). Renders its children with the drag handle's props injected so only the grip icon is a drag target, not the whole row. */
function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: { attributes: DraggableAttributes; listeners: SyntheticListenerMap | undefined; isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

export default function CategoriesSettingsPage() {
  const [tree, setTree] = useState<CategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [icon, setIcon] = useState("circle");
  const [color, setColor] = useState("neutral");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tables<"categories"> | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<"deactivate" | "delete" | "merge" | null>(null);

  async function load() {
    setLoading(true);
    const result = await listCategoriesForHousehold({ includeInactive: showInactive });
    if (result.data) setTree(result.data.tree);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch whenever the active/inactive toggle changes
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const flat: FlatRow[] = useMemo(
    () => tree.flatMap((p) => [{ ...p, parentName: null }, ...p.children.map((c) => ({ ...c, parentName: p.name }))]),
    [tree]
  );

  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return tree
      .map((p) => ({ ...p, children: p.children.filter((c) => c.name.toLowerCase().includes(q)) }))
      .filter((p) => p.name.toLowerCase().includes(q) || p.children.length > 0);
  }, [tree, query]);

  const allCategoryOptions = flat.filter((c) => c.is_active !== false);

  const dragEnabled = !selectMode && !query.trim();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEndTopLevel(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tree.map((c) => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedTree = arrayMove(tree, oldIndex, newIndex);
    setTree(reorderedTree);
    await reorderCategories(reorderedTree.map((c) => c.id));
  }

  async function handleDragEndChildren(parentId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const parent = tree.find((p) => p.id === parentId);
    if (!parent) return;
    const ids = parent.children.map((c) => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedChildren = arrayMove(parent.children, oldIndex, newIndex);
    setTree(tree.map((p) => (p.id === parentId ? { ...p, children: reorderedChildren } : p)));
    await reorderCategories(reorderedChildren.map((c) => c.id));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEditFlow(cat: Tables<"categories">) {
    setEditingId(cat.id);
    setName(cat.name);
    setParentId(cat.parent_id);
    setIcon(cat.icon ?? "circle");
    setColor(cat.color ?? "neutral");
    setCreating(true);
  }

  function closeSheet() {
    setCreating(false);
    setEditingId(null);
    setName("");
    setParentId(null);
    setIcon("circle");
    setColor("neutral");
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const result = editingId
      ? await updateCategory(editingId, { name: name.trim(), icon, color })
      : await createCategory({ name: name.trim(), parent_id: parentId, icon, color, sort_order: 999 });
    setSaving(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(editingId ? `"${result.data.name}" updated` : `"${result.data.name}" added`);
    closeSheet();
    load();
  }

  async function openDeleteFlow(cat: Tables<"categories">) {
    setDeleteTarget(cat);
    setUsageCount(null);
    setReassignTo(null);
    const result = await getCategoryUsageCount(cat.id);
    if (result.data) setUsageCount(result.data.count);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (usageCount && usageCount > 0) {
      if (!reassignTo) {
        toast.error("Pick a category to move those expenses to first");
        return;
      }
      const result = await reassignAndDeleteCategory(deleteTarget.id, reassignTo);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved ${usageCount} expense(s) and deleted "${deleteTarget.name}"`);
    } else {
      const result = await deleteCategory(deleteTarget.id);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted");
    }
    setDeleteTarget(null);
    load();
  }

  async function handleToggleActive(cat: Tables<"categories">) {
    const nextActive = cat.is_active === false;
    const result = await setCategoryActive(cat.id, nextActive);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(nextActive ? `"${cat.name}" reactivated` : `"${cat.name}" deactivated — hidden from pickers, history kept`);
    load();
  }

  async function handleMove(cat: Tables<"categories">, direction: -1 | 1) {
    const siblings = cat.parent_id ? tree.find((p) => p.id === cat.parent_id)?.children ?? [] : tree;
    const idx = siblings.findIndex((s) => s.id === cat.id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    await reorderCategories(reordered.map((s) => s.id));
    load();
  }

  async function handleBulkDeactivate() {
    const result = await bulkDeactivateCategories([...selected]);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.deactivated} categor${result.data.deactivated === 1 ? "y" : "ies"} deactivated`);
    setSelected(new Set());
    setSelectMode(false);
    load();
  }

  async function handleBulkDelete() {
    const result = await bulkDeleteCategories([...selected]);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const { deleted, skipped } = result.data;
    if (skipped > 0) {
      toast(`Deleted ${deleted}, skipped ${skipped} still in use — deactivate those instead`);
    } else {
      toast.success(`${deleted} categor${deleted === 1 ? "y" : "ies"} deleted`);
    }
    setSelected(new Set());
    setSelectMode(false);
    load();
  }

  async function handleBulkMerge() {
    const ids = [...selected];
    if (ids.length !== 2) {
      toast.error("Select exactly two categories to merge");
      return;
    }
    const [a, b] = ids;
    const nameA = flat.find((c) => c.id === a)?.name ?? "first";
    const nameB = flat.find((c) => c.id === b)?.name ?? "second";
    // Keep whichever one is the household's own record as canonical when possible; otherwise the first pick wins.
    const canonical = flat.find((c) => c.id === a)?.household_id ? a : b;
    const duplicate = canonical === a ? b : a;
    const result = await mergeCategories(canonical, duplicate);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(`Merged "${nameA}" and "${nameB}" — ${result.data.expensesReassigned} expense(s) moved`);
    setSelected(new Set());
    setSelectMode(false);
    load();
  }

  const bulkConfirmCopy: Record<NonNullable<typeof bulkConfirm>, { title: string; description: string; confirmLabel: string; destructive: boolean; onConfirm: () => Promise<void> }> = {
    deactivate: {
      title: `Deactivate ${selected.size} categor${selected.size === 1 ? "y" : "ies"}?`,
      description: "They'll be hidden from pickers everywhere, but every past expense keeps its category. You can reactivate any of them later.",
      confirmLabel: "Deactivate",
      destructive: false,
      onConfirm: handleBulkDeactivate,
    },
    delete: {
      title: `Delete ${selected.size} categor${selected.size === 1 ? "y" : "ies"}?`,
      description: "Only categories with zero expenses attached will actually be removed — any still in use are skipped so you can deactivate them instead. This can't be undone for the ones that are deleted.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: handleBulkDelete,
    },
    merge: {
      title: "Merge these two categories?",
      description: "Every expense on the duplicate will be moved onto the one you keep, then the duplicate is removed. This can't be undone.",
      confirmLabel: "Merge",
      destructive: false,
      onConfirm: handleBulkMerge,
    },
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Categories</h1>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setSelectMode((v) => !v);
            setSelected(new Set());
          }}
        >
          {selectMode ? "Cancel" : "Select"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search categories" className="pl-9" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)} className="shrink-0">
          {showInactive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showInactive ? "Hide inactive" : "Show inactive"}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filteredTree.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No categories match “{query}”.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndTopLevel}>
          <SortableContext items={filteredTree.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {filteredTree.map((cat) => (
                <SortableItem key={cat.id} id={cat.id} disabled={!dragEnabled}>
                  {({ attributes, listeners, isDragging }) => (
                    <div className={cn("rounded-xl border border-border bg-card", cat.is_active === false && "opacity-50", isDragging && "shadow-lg ring-2 ring-primary")}>
                      <div className="flex items-center gap-3 border-b border-border p-3">
                        {selectMode && (
                          <button onClick={() => toggleSelect(cat.id)} className="shrink-0 text-muted-foreground">
                            {selected.has(cat.id) ? <CheckSquare className="h-4.5 w-4.5 text-primary" /> : <Square className="h-4.5 w-4.5" />}
                          </button>
                        )}
                        {dragEnabled && (
                          <button {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label="Drag to reorder">
                            <GripVertical className="h-4 w-4" />
                          </button>
                        )}
                        <CategoryIcon icon={cat.icon} color={cat.color} />
                        <span className="font-medium text-foreground">{cat.name}</span>
                        {cat.is_active === false && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                        {!cat.household_id ? (
                          <Badge variant="outline" className="ml-auto">
                            Default
                          </Badge>
                        ) : (
                          !selectMode && (
                            <div className="ml-auto flex items-center gap-0.5">
                              <button onClick={() => handleMove(cat, -1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleMove(cat, 1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleToggleActive(cat)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" title={cat.is_active === false ? "Reactivate" : "Deactivate"}>
                                {cat.is_active === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              </button>
                              <button onClick={() => openEditFlow(cat)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => openDeleteFlow(cat)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                      {cat.children.length > 0 && (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEndChildren(cat.id, e)}>
                          <SortableContext items={cat.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-col divide-y divide-border">
                              {cat.children.map((sub) => (
                                <SortableItem key={sub.id} id={sub.id} disabled={!dragEnabled}>
                                  {({ attributes: subAttrs, listeners: subListeners, isDragging: subDragging }) => (
                                    <div
                                      className={cn(
                                        "flex items-center gap-3 bg-card px-3 py-2.5 pl-6",
                                        sub.is_active === false && "opacity-50",
                                        subDragging && "shadow-lg ring-2 ring-primary"
                                      )}
                                    >
                                      {selectMode && (
                                        <button onClick={() => toggleSelect(sub.id)} className="shrink-0 text-muted-foreground">
                                          {selected.has(sub.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                                        </button>
                                      )}
                                      {dragEnabled && (
                                        <button {...subAttrs} {...subListeners} className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label="Drag to reorder">
                                          <GripVertical className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      <CategoryIcon icon={sub.icon} color={cat.color} className="flex h-8 w-8 items-center justify-center rounded-lg" />
                                      <span className="text-sm text-foreground">{sub.name}</span>
                                      {sub.is_active === false && (
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                          Inactive
                                        </Badge>
                                      )}
                                      {sub.household_id && !selectMode && (
                                        <div className="ml-auto flex items-center gap-0.5">
                                          <button onClick={() => handleMove(sub, -1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                                            <ChevronUp className="h-3 w-3" />
                                          </button>
                                          <button onClick={() => handleMove(sub, 1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                                            <ChevronDown className="h-3 w-3" />
                                          </button>
                                          <button onClick={() => handleToggleActive(sub)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                                            {sub.is_active === false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                          </button>
                                          <button onClick={() => openEditFlow(sub)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" title="Edit">
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button onClick={() => openDeleteFlow(sub)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </SortableItem>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                      {!selectMode && (
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setParentId(cat.id);
                            setIcon("circle");
                            setColor("neutral");
                            setName("");
                            setCreating(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-b-xl px-3 py-2.5 pl-6 text-sm text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add subcategory
                        </button>
                      )}
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!selectMode && (
        <Button
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setParentId(null);
            setIcon("circle");
            setColor("neutral");
            setName("");
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add top-level category
        </Button>
      )}

      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-6">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-xs font-medium text-muted-foreground">{selected.size} selected</span>
            {selected.size === 2 && (
              <Button size="sm" variant="ghost" onClick={() => setBulkConfirm("merge")}>
                <Merge className="h-3.5 w-3.5" /> Merge
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setBulkConfirm("deactivate")}>
              <EyeOff className="h-3.5 w-3.5" /> Deactivate
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setBulkConfirm("delete")}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {bulkConfirm && (
        <ConfirmationDialog
          open={!!bulkConfirm}
          onOpenChange={(open) => !open && setBulkConfirm(null)}
          title={bulkConfirmCopy[bulkConfirm].title}
          description={bulkConfirmCopy[bulkConfirm].description}
          confirmLabel={bulkConfirmCopy[bulkConfirm].confirmLabel}
          destructive={bulkConfirmCopy[bulkConfirm].destructive}
          onConfirm={async () => {
            await bulkConfirmCopy[bulkConfirm].onConfirm();
            setBulkConfirm(null);
          }}
        />
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={closeSheet}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {editingId ? "Edit category" : parentId ? "Add subcategory" : "Add category"}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" autoFocus />
              </div>
              <div>
                <Label>Icon</Label>
                <div className="mt-1.5 flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-2">
                  {ICON_PICKER_OPTIONS.map((i) => (
                    <button key={i} onClick={() => setIcon(i)} className={cn("rounded-lg p-0.5", icon === i && "ring-2 ring-primary")}>
                      <CategoryIcon icon={i} color={color} className="flex h-9 w-9 items-center justify-center rounded-lg" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <div className="mt-1.5 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-2">
                  {COLOR_PICKER_OPTIONS.map((c) => {
                    const swatch = colorSwatch(c);
                    return (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: swatch.bg }}
                        className={cn("h-9 w-9 rounded-full", color === c && "ring-2 ring-primary ring-offset-2")}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={closeSheet}>
                  Cancel
                </Button>
                <Button className="flex-1" loading={saving} disabled={!name.trim()} onClick={handleCreate}>
                  {editingId ? "Save changes" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={
          usageCount === null
            ? "Checking whether this category is in use…"
            : usageCount > 0
              ? `${usageCount} expense(s) still use this category. Pick where they should move to below, or deactivate the category instead to keep it hidden without losing history.`
              : "This category isn't used by any expenses and can be safely removed. This can't be undone."
        }
        onConfirm={handleDelete}
        confirmDisabled={usageCount === null || (usageCount > 0 && !reassignTo)}
      >
        {usageCount !== null && usageCount > 0 && (
          <div className="mt-3">
            <Label className="text-xs">Move expenses to</Label>
            <select
              value={reassignTo ?? ""}
              onChange={(e) => setReassignTo(e.target.value || null)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a category…</option>
              {allCategoryOptions
                .filter((c) => c.id !== deleteTarget?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentName ? `${c.parentName} → ${c.name}` : c.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </ConfirmationDialog>
    </div>
  );
}
