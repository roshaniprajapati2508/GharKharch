"use client";

import { createContext, useContext } from "react";

export interface HouseholdContextValue {
  householdId: string;
  householdName: string;
  inviteCode: string;
  userId: string;
  isOwner: boolean;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  partner: { id: string; displayName: string; avatarUrl: string | null } | null;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  value,
  children,
}: {
  value: HouseholdContextValue;
  children: React.ReactNode;
}) {
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within a HouseholdProvider");
  return ctx;
}
