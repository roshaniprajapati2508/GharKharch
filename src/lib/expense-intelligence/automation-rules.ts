// IFTTT-style Smart Rules matching engine (spec: Module 1 - Developer
// Implementation Brief). Pure/client-safe (no Supabase calls): the rules
// themselves are loaded once via `listAutomationRules()` in
// `actions/automation-rules.ts` and handed to `matchAutomationRule` here,
// along with the household's already-loaded category tree / merchant list
// / partner info, so this can run at 0ms on every keystroke or voice-input
// commit without a network round trip - exactly like the existing
// suggestMerchant / matchKeywordRule engines it sits alongside.
//
// `automation_rules.conditions`/`actions` store category/merchant/paid-by
// by NAME, not raw id (see migration 024's comment for why) - this module
// is what resolves those names to real ids/objects for the given
// household, the same "resolve by name at use-time" pattern already used
// by the category/merchant suggesters.

import type { CategoryWithChildren } from "@/lib/actions/categories";
import type { Tables } from "@/types/database";

export interface AutomationRuleConditions {
  keywords: string[];
  min_amount: number | null;
  max_amount: number | null;
  entry_type: "expense" | "income" | null;
  time_of_day: string | null;
}

export interface AutomationRuleActions {
  category_name: string | null;
  subcategory_name: string | null;
  merchant_name: string | null;
  payment_method: string | null;
  paid_by_name: string | null;
  entry_type: "expense" | "income" | null;
}

export interface AutomationRule {
  id: string;
  household_id: string | null;
  name: string;
  priority: number;
  is_active: boolean;
  conditions: AutomationRuleConditions;
  actions: AutomationRuleActions;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
}

/** Resolved, ready-to-apply result of a matched rule - shapes mirror exactly what AddExpenseSheet's `form.category` / `form.merchant` / `form.paidBy` / `form.paymentMethod` already expect, so applying a match is a single setForm call. */
export interface ResolvedRuleMatch {
  ruleId: string;
  ruleName: string;
  category: { categoryId: string; subcategoryId: string | null; categoryName: string; subcategoryName: string | null } | null;
  merchant: Tables<"merchants"> | null;
  paymentMethod: string | null;
  paidBy: string | null;
  entryType: "expense" | "income" | null;
}

export interface HouseholdMemberOption {
  id: string;
  displayName: string;
}

function normalizeText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text.toLowerCase().trim();
}

/**
 * Finds the best matching active rule for the given raw item text (and
 * optional amount/entry type context), highest `priority` first, first
 * defined-order win on a tie. A rule matches when at least one of its
 * keywords appears as a substring anywhere in the (lowercased) text, and
 * every other condition it specifies (min/max amount, entry_type) is
 * satisfied by the current context - conditions left null are ignored.
 */
export function matchAutomationRule(
  rawText: string,
  rules: AutomationRule[],
  context?: { amount?: number | null; entryType?: "expense" | "income" | null }
): AutomationRule | null {
  const text = normalizeText(rawText);
  if (!text) return null;

  const candidates = (rules ?? [])
    .filter((r) => r && r.is_active && r.conditions)
    .filter((r) => Array.isArray(r.conditions.keywords) && r.conditions.keywords.some((kw) => kw && text.includes(normalizeText(kw))))
    .filter((r) => {
      const amount = context?.amount ?? null;
      if (r.conditions.min_amount !== null && r.conditions.min_amount !== undefined && amount !== null && amount < r.conditions.min_amount) return false;
      if (r.conditions.max_amount !== null && r.conditions.max_amount !== undefined && amount !== null && amount > r.conditions.max_amount) return false;
      if (r.conditions.entry_type && context?.entryType && r.conditions.entry_type !== context.entryType) return false;
      return true;
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return candidates[0] ?? null;
}

/** Resolves a matched rule's name-based actions into real ids/objects for this household. Any field whose name can't be found (category renamed/hidden, merchant not yet created, partner not set) is simply left null - the rest of the match still applies. */
export function resolveRuleActions(
  rule: AutomationRule,
  categoryTree: CategoryWithChildren[],
  merchants: Tables<"merchants">[],
  members: HouseholdMemberOption[]
): ResolvedRuleMatch {
  const a = rule.actions;

  let category: ResolvedRuleMatch["category"] = null;
  if (a.category_name) {
    const parent = categoryTree.find((c) => c.name.toLowerCase() === a.category_name!.toLowerCase());
    if (parent) {
      const sub = a.subcategory_name ? parent.children.find((c) => c.name.toLowerCase() === a.subcategory_name!.toLowerCase()) ?? null : null;
      category = {
        categoryId: parent.id,
        subcategoryId: sub?.id ?? null,
        categoryName: parent.name,
        subcategoryName: sub?.name ?? null,
      };
    }
  }

  let merchant: Tables<"merchants"> | null = null;
  if (a.merchant_name) {
    merchant = merchants.find((m) => m.name.toLowerCase() === a.merchant_name!.toLowerCase()) ?? null;
  }

  let paidBy: string | null = null;
  if (a.paid_by_name) {
    const member = members.find((m) => m.displayName.toLowerCase() === a.paid_by_name!.toLowerCase());
    paidBy = member?.id ?? null;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    category,
    merchant,
    paymentMethod: a.payment_method ?? null,
    paidBy,
    entryType: a.entry_type ?? null,
  };
}
