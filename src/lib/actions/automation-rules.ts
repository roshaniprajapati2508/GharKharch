"use server";

import { revalidatePath } from "next/cache";
import { automationRuleFormSchema, type AutomationRuleFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import { logActivityEvent } from "@/lib/actions/activity-events";
import type { AutomationRule } from "@/lib/expense-intelligence/automation-rules";

function toRule(row: Record<string, unknown>): AutomationRule {
  return {
    id: row.id as string,
    household_id: (row.household_id as string) ?? null,
    name: row.name as string,
    priority: row.priority as number,
    is_active: row.is_active as boolean,
    conditions: row.conditions as AutomationRule["conditions"],
    actions: row.actions as AutomationRule["actions"],
    execution_count: row.execution_count as number,
    last_executed_at: (row.last_executed_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

/** Global (household_id null) default rules this household hasn't hidden + this household's own rules, priority desc - same "global + household, minus hidden" pattern as listMerchantsForHousehold/listCategoriesForHousehold. */
export async function listAutomationRules() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const [{ data: hiddenRows }, { data, error }] = await Promise.all([
      supabase.from("household_hidden_automation_rules").select("rule_id").eq("household_id", householdId),
      supabase
        .from("automation_rules")
        .select("*")
        .or(`household_id.is.null,household_id.eq.${householdId}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);
    if (error) throw new ActionError(error.message);
    const hiddenIds = new Set((hiddenRows ?? []).map((r) => r.rule_id));
    return (data ?? []).filter((r) => !hiddenIds.has(r.id)).map(toRule);
  });
}

export async function createAutomationRule(rawInput: AutomationRuleFormInput) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const parsed = automationRuleFormSchema.parse(rawInput);
    const { data, error } = await supabase
      .from("automation_rules")
      .insert({
        household_id: householdId,
        name: parsed.name,
        priority: parsed.priority,
        is_active: parsed.is_active,
        conditions: parsed.conditions,
        actions: parsed.actions,
      })
      .select()
      .single();
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/rules");
    return toRule(data);
  });
}

export async function updateAutomationRule(id: string, rawInput: Partial<AutomationRuleFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing, error: fetchError } = await supabase.from("automation_rules").select("household_id").eq("id", id).single();
    if (fetchError || !existing) throw new ActionError("Rule not found");
    if (existing.household_id !== householdId) throw new ActionError("You can only edit your own rules, not a global default - deactivate it instead");

    const patch: Partial<{
      name: string;
      priority: number;
      is_active: boolean;
      conditions: AutomationRuleFormInput["conditions"];
      actions: AutomationRuleFormInput["actions"];
    }> = {};
    if (rawInput.name !== undefined) patch.name = rawInput.name;
    if (rawInput.priority !== undefined) patch.priority = rawInput.priority;
    if (rawInput.is_active !== undefined) patch.is_active = rawInput.is_active;
    if (rawInput.conditions !== undefined) patch.conditions = rawInput.conditions;
    if (rawInput.actions !== undefined) patch.actions = rawInput.actions;

    const { data, error } = await supabase.from("automation_rules").update(patch).eq("id", id).select().single();
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/rules");
    return toRule(data);
  });
}

/** Global default rules can be turned off per-household (via household_hidden_automation_rules, migration 024) even though a household can't edit or delete the shared row outright - same "hide, don't mutate the shared row" affordance as global categories/merchants (migration 014). A household's own rule is just a plain is_active flip. */
export async function toggleAutomationRule(id: string, isActive: boolean) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing, error: fetchError } = await supabase.from("automation_rules").select("household_id").eq("id", id).single();
    if (fetchError || !existing) throw new ActionError("Rule not found");
    if (existing.household_id !== null && existing.household_id !== householdId) throw new ActionError("Not your rule");

    if (existing.household_id === null) {
      if (isActive) {
        await supabase.from("household_hidden_automation_rules").delete().eq("household_id", householdId).eq("rule_id", id);
      } else {
        await supabase.from("household_hidden_automation_rules").insert({ household_id: householdId, rule_id: id });
      }
      revalidatePath("/more/rules");
      return true;
    }

    const { error } = await supabase.from("automation_rules").update({ is_active: isActive }).eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/rules");
    return true;
  });
}

export async function deleteAutomationRule(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data: existing, error: fetchError } = await supabase.from("automation_rules").select("household_id").eq("id", id).single();
    if (fetchError || !existing) throw new ActionError("Rule not found");
    if (existing.household_id !== householdId) throw new ActionError("You can only delete your own rules, not a global default - turn it off instead");
    const { error } = await supabase.from("automation_rules").delete().eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/rules");
    return true;
  });
}

/** Fire-and-forget bump of a rule's usage stats when it auto-fills a save - never blocks or fails the expense save itself. */
export async function recordRuleExecution(id: string, ruleName?: string) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const { data: existing } = await supabase.from("automation_rules").select("execution_count, name").eq("id", id).maybeSingle();
    await supabase
      .from("automation_rules")
      .update({ execution_count: (existing?.execution_count ?? 0) + 1, last_executed_at: new Date().toISOString() })
      .eq("id", id);
    try {
      await logActivityEvent(supabase, {
        householdId,
        actorId: userId,
        eventType: "rule_triggered",
        entityType: "rule",
        entityId: id,
        summary: `Smart Rule "${ruleName ?? existing?.name ?? "Untitled"}" auto-filled an entry`,
      });
    } catch {
      // Activity logging must never fail the rule-usage bump.
    }
    return true;
  });
}
