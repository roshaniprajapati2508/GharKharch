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
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  // This layout runs on every full/hard navigation into the (app) segment, so each
  // extra sequential round trip here is latency every page in the app pays on top
  // of its own data fetch. household_members.user_id and profiles.id both reference
  // auth.users but aren't FK'd to each other, so they can't be embedded in one
  // PostgREST query - but we can still fetch household + member ids in parallel,
  // then fetch every member's profile (mine and the partner's) in a single `.in()`
  // query instead of two separate profile look-ups.
  const [{ data: household }, { data: members }] = await Promise.all([
    supabase.from("households").select("id, name, invite_code").eq("id", membership.household_id).single(),
    supabase.from("household_members").select("user_id, role").eq("household_id", membership.household_id),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const isOwner = (members ?? []).find((m) => m.user_id === user.id)?.role === "owner";
  const partnerUserId = memberIds.find((id) => id !== user.id) ?? null;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", memberIds.length > 0 ? memberIds : [user.id]);

  const profile = (profiles ?? []).find((p) => p.id === user.id) ?? null;
  const partnerProfile = partnerUserId ? (profiles ?? []).find((p) => p.id === partnerUserId) ?? null : null;
  const partnerDisplayName = partnerProfile?.display_name ?? null;
  const partnerAvatarUrl = partnerProfile?.avatar_url ?? null;

  return (
    <HouseholdProvider
      value={{
        householdId: household!.id,
        householdName: household!.name,
        inviteCode: household!.invite_code,
        userId: user.id,
        isOwner,
        displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "You",
        username: profile?.username ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        partner: partnerUserId
          ? { id: partnerUserId, displayName: partnerDisplayName ?? "Partner", avatarUrl: partnerAvatarUrl }
          : null,
      }}
    >
      <AppShell>{children}</AppShell>
    </HouseholdProvider>
  );
}
