import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseholdProvider } from "@/lib/context/household-context";
import { AppShell } from "@/components/shared/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  // Fetch household, all members, and current user's profile in parallel to reduce sequential latency
  const [{ data: household }, { data: members }, { data: profile }] = await Promise.all([
    supabase.from("households").select("id, name, invite_code").eq("id", membership.household_id).single(),
    supabase.from("household_members").select("user_id, role").eq("household_id", membership.household_id),
    supabase.from("profiles").select("id, display_name, username, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const isOwner = membership.role === "owner";
  const partnerUserId = memberIds.find((id) => id !== user.id) ?? null;

  let partnerProfile: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null = null;
  if (partnerUserId) {
    const { data: pProfile } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .eq("id", partnerUserId)
      .maybeSingle();
    partnerProfile = pProfile ?? null;
  }

  return (
    <HouseholdProvider
      value={{
        householdId: household?.id ?? membership.household_id,
        householdName: household?.name ?? "Household",
        inviteCode: household?.invite_code ?? "",
        userId: user.id,
        isOwner,
        displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "You",
        username: profile?.username ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        partner: partnerUserId
          ? { id: partnerUserId, displayName: partnerProfile?.display_name ?? "Partner", avatarUrl: partnerProfile?.avatar_url ?? null }
          : null,
      }}
    >
      <AppShell>{children}</AppShell>
    </HouseholdProvider>
  );
}
