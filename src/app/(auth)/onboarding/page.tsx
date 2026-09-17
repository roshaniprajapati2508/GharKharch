"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingIllustration } from "@/components/shared/illustrations";

type Mode = "choose" | "create" | "join";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [householdName, setHouseholdName] = useState("Our Household");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createHousehold() {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_household", { p_name: householdName });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't create your household", { description: error.message });
      return;
    }
    toast.success("Household created");
    router.replace("/dashboard");
    router.refresh();
  }

  async function joinHousehold() {
    if (!inviteCode.trim()) {
      toast.error("Enter the invite code your partner shared");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("join_household_by_code", { p_code: inviteCode.trim() });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't join that household", { description: error.message });
      return;
    }
    toast.success("You're in!");
    router.replace("/dashboard");
    router.refresh();
  }

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-6 text-center">
        <OnboardingIllustration className="mx-auto h-24 w-auto" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Set up your household</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GharKharch is shared between exactly two people. Start fresh, or join your partner.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => setMode("create")}>
            Create a new household
          </Button>
          <Button size="lg" variant="outline" onClick={() => setMode("join")}>
            Join with an invite code
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Name your household</h1>
          <p className="mt-1 text-sm text-muted-foreground">You can change this later in Settings.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="householdName">Household name</Label>
          <Input id="householdName" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
        </div>
        <Button size="lg" onClick={createHousehold} loading={submitting}>
          Create household
        </Button>
        <Button variant="ghost" onClick={() => setMode("choose")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Join your partner&apos;s household</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask them to open Settings → Household and share the invite code.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inviteCode">Invite code</Label>
        <Input
          id="inviteCode"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="e.g. 8f3a2c1d"
          className="text-center tracking-widest"
        />
      </div>
      <Button size="lg" onClick={joinHousehold} loading={submitting}>
        Join household
      </Button>
      <Button variant="ghost" onClick={() => setMode("choose")}>
        Back
      </Button>
    </div>
  );
}
