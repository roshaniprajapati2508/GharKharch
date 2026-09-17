"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,20}$/, "3-20 characters: lowercase letters, numbers, dot or underscore")
  .nullable();

const profileFormSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your name").max(80).optional(),
  username: usernameSchema.optional(),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

export async function getMyProfile() {
  return runAction(async () => {
    const { supabase, userId } = await requireHouseholdContext();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new ActionError(error.message);
    if (!data) throw new ActionError("Profile not found");
    return data as Tables<"profiles">;
  });
}

export async function updateMyProfile(rawInput: ProfileFormInput) {
  return runAction(async () => {
    const { supabase, userId } = await requireHouseholdContext();
    const input = profileFormSchema.parse(rawInput);

    if (input.username) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", input.username)
        .neq("id", userId)
        .maybeSingle();
      if (taken) throw new ActionError("That username is already taken");
    }

    const { data, error } = await supabase.from("profiles").update(input).eq("id", userId).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update your profile");

    revalidatePath("/more/profile");
    revalidatePath("/", "layout");
    return data as Tables<"profiles">;
  });
}

/**
 * Persists a freshly-uploaded avatar's public URL (the actual file upload to
 * Supabase Storage happens client-side against `profile-images/{user_id}/...`
 * - RLS on `storage.objects` from migration 012 already restricts that path
 * to the signed-in owner, so this action only needs to record the resulting
 * URL against the profile row and clean up the previous file).
 */
export async function setMyAvatarUrl(avatarUrl: string | null) {
  return runAction(async () => {
    const { supabase, userId } = await requireHouseholdContext();
    const { data, error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId).select().single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update your photo");
    revalidatePath("/more/profile");
    revalidatePath("/", "layout");
    return data as Tables<"profiles">;
  });
}
