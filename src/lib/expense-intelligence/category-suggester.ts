// Category suggestion engine (spec section 12, 19).
//
// The spec's scoring tiers are:
//   1. Exact merchant mapping    4. Household history
//   2. Exact item mapping        5. Keyword matching
//   3. Previous user correction  6. Frequency          7. Default category
//
// GharKharch doesn't keep a separate "correction log" table - instead,
// `expense_patterns` (keyed on item_name + merchant_id) already always holds
// the MOST RECENTLY chosen category for that exact pairing (see
// `upsertExpensePattern` in actions/expenses.ts, which overwrites category_id
// on every save). So tiers 1-4 collapse cleanly onto three real queries,
// ordered most-specific first: exact (item, merchant) → item alone → merchant
// alone. Tiers 5-7 are the static keyword map, then plain household
// frequency, then no suggestion at all.

import type { CategoryWithChildren } from "@/lib/actions/categories";
import { matchKeywordRule } from "@/lib/expense-intelligence/keyword-map";

export interface CategorySuggestion {
  categoryId: string;
  subcategoryId: string | null;
  categoryName: string;
  subcategoryName: string | null;
  confidence: number; // 0..1
  reason: string;
}

export interface PatternAggregate {
  category_id: string;
  subcategory_id: string | null;
  usage_count: number;
}

export interface CategorySuggesterContext {
  /** Aggregated usage for the exact (normalized item_name, merchant_id) pair, if any. */
  exactItemMerchant: PatternAggregate | null;
  /** Usage summed across all merchants for this item_name, grouped by category. Highest-usage row first. */
  byItem: PatternAggregate[];
  /** Usage summed across all items for this merchant_id, grouped by category. Highest-usage row first. */
  byMerchant: PatternAggregate[];
  /** The household's own category tree (global + household-owned), used to resolve keyword-matched names to real ids. */
  categoryTree: CategoryWithChildren[];
  /** The single most-used category_id/subcategory_id across the whole household's recent history (tier 6 fallback). */
  mostUsedOverall: PatternAggregate | null;
}

function resolveCategoryNames(categoryId: string, subcategoryId: string | null, tree: CategoryWithChildren[]) {
  for (const cat of tree) {
    if (cat.id === categoryId) {
      const sub = subcategoryId ? cat.children.find((c) => c.id === subcategoryId) : null;
      return { categoryName: cat.name, subcategoryName: sub?.name ?? null };
    }
    const asChild = cat.children.find((c) => c.id === categoryId);
    if (asChild) {
      return { categoryName: cat.name, subcategoryName: asChild.name };
    }
  }
  return null;
}

function findByName(tree: CategoryWithChildren[], categoryName: string, subcategoryName?: string) {
  const cat = tree.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!cat) return null;
  if (!subcategoryName) return { categoryId: cat.id, subcategoryId: null };
  const sub = cat.children.find((c) => c.name.toLowerCase() === subcategoryName.toLowerCase());
  return { categoryId: cat.id, subcategoryId: sub?.id ?? null };
}

/** Pure scoring function - every DB read happens in the caller (a server action), so this stays trivially testable. */
export function suggestCategory(itemName: string, ctx: CategorySuggesterContext): CategorySuggestion | null {
  if (typeof itemName !== "string") return null;
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return null;

  // Tier 1+3: exact (item, merchant) pairing - the most specific and most
  // recently-corrected signal available.
  if (ctx.exactItemMerchant) {
    const names = resolveCategoryNames(ctx.exactItemMerchant.category_id, ctx.exactItemMerchant.subcategory_id, ctx.categoryTree);
    if (names) {
      return {
        categoryId: ctx.exactItemMerchant.category_id,
        subcategoryId: ctx.exactItemMerchant.subcategory_id,
        ...names,
        confidence: Math.min(0.99, 0.85 + ctx.exactItemMerchant.usage_count * 0.02),
        reason: `You've categorized "${itemName.trim()}" here as ${names.subcategoryName ?? names.categoryName} before.`,
      };
    }
  }

  // Tier 2: exact item mapping, regardless of merchant.
  const topByItem = ctx.byItem[0];
  if (topByItem) {
    const names = resolveCategoryNames(topByItem.category_id, topByItem.subcategory_id, ctx.categoryTree);
    if (names) {
      return {
        categoryId: topByItem.category_id,
        subcategoryId: topByItem.subcategory_id,
        ...names,
        confidence: Math.min(0.95, 0.7 + topByItem.usage_count * 0.03),
        reason: `Previously categorized as ${names.subcategoryName ?? names.categoryName} ${topByItem.usage_count} time${topByItem.usage_count === 1 ? "" : "s"}.`,
      };
    }
  }

  // Tier 4: household history for this merchant, across any item.
  const topByMerchant = ctx.byMerchant[0];
  if (topByMerchant) {
    const names = resolveCategoryNames(topByMerchant.category_id, topByMerchant.subcategory_id, ctx.categoryTree);
    if (names) {
      return {
        categoryId: topByMerchant.category_id,
        subcategoryId: topByMerchant.subcategory_id,
        ...names,
        confidence: Math.min(0.75, 0.5 + topByMerchant.usage_count * 0.02),
        reason: `Most of your expenses at this merchant are categorized as ${names.subcategoryName ?? names.categoryName}.`,
      };
    }
  }

  // Tier 5: static keyword matching against the item name.
  const keywordRule = matchKeywordRule(normalized);
  if (keywordRule) {
    const resolved = findByName(ctx.categoryTree, keywordRule.categoryName, keywordRule.subcategoryName);
    if (resolved) {
      const names = resolveCategoryNames(resolved.categoryId, resolved.subcategoryId, ctx.categoryTree);
      if (names) {
        return {
          categoryId: resolved.categoryId,
          subcategoryId: resolved.subcategoryId,
          ...names,
          confidence: 0.6,
          reason: `"${itemName.trim()}" usually falls under ${names.subcategoryName ?? names.categoryName}.`,
        };
      }
    }
  }

  // Tier 6: household's single most-used category overall, as a low-confidence nudge.
  if (ctx.mostUsedOverall) {
    const names = resolveCategoryNames(ctx.mostUsedOverall.category_id, ctx.mostUsedOverall.subcategory_id, ctx.categoryTree);
    if (names) {
      return {
        categoryId: ctx.mostUsedOverall.category_id,
        subcategoryId: ctx.mostUsedOverall.subcategory_id,
        ...names,
        confidence: 0.3,
        reason: `${names.categoryName} is your most-used category.`,
      };
    }
  }

  // Tier 7: no confident default - let the user pick.
  return null;
}
