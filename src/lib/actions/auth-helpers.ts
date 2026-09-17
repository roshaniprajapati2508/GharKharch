// Note: not importing the `server-only` package (not an installed dependency) —
// every consumer of this module is itself a `"use server"` action file or a
// Server Component, so it never reaches a client bundle.
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the authenticated caller and their household id, entirely
 * server-side. Server actions must call this instead of trusting any
 * household_id passed from the client (spec section 71: a user must never be
 * able to manipulate household_id to reach another household's data).
 */
export async function requireHouseholdContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ActionError("Not signed in");
  }

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    throw new ActionError("No household found for this account");
  }

  return { supabase, userId: user.id, householdId: membership.household_id };
}

export class ActionError extends Error {}

export type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    const message = err instanceof ActionError ? err.message : err instanceof Error ? err.message : "Something went wrong";
    return { data: null, error: message };
  }
}
