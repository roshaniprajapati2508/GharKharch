"use server";

import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";

/** The household's autosaved scratchpad text (migration 026), or "" if nothing's been typed yet. */
export async function getScratchpadDraft() {
  return runAction(async (): Promise<string> => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase.from("scratchpad_drafts").select("content").eq("household_id", householdId).maybeSingle();
    if (error) throw new ActionError(error.message);
    return data?.content ?? "";
  });
}

/** Upserts the household's scratchpad text - called on a debounced interval while typing, not on every keystroke, so this stays a light autosave rather than a chat-speed round trip. */
export async function saveScratchpadDraft(content: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase
      .from("scratchpad_drafts")
      .upsert({ household_id: householdId, content, updated_at: new Date().toISOString() });
    if (error) throw new ActionError(error.message);
    return true;
  });
}

/** Clears the draft once its lines have been converted to real expenses ("Save All to GharKharch"). */
export async function clearScratchpadDraft() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.from("scratchpad_drafts").delete().eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    return true;
  });
}
