"use server";

import { revalidatePath } from "next/cache";
import {
  userCardFormSchema,
  bankAccountFormSchema,
  upiProfileFormSchema,
  type UserCardFormInput,
  type BankAccountFormInput,
  type UpiProfileFormInput,
} from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

// ---------------------------------------------------------------------------
// Card catalogue (system data, read-only to the app)
// ---------------------------------------------------------------------------

export async function listCardCatalogue() {
  return runAction(async () => {
    const { supabase } = await requireHouseholdContext();
    const [{ data: issuers, error: issuersError }, { data: products, error: productsError }] = await Promise.all([
      supabase.from("card_issuers").select("*").eq("is_active", true).order("name"),
      supabase.from("card_products").select("*").eq("is_active", true).order("name"),
    ]);
    if (issuersError) throw new ActionError(issuersError.message);
    if (productsError) throw new ActionError(productsError.message);
    return {
      issuers: (issuers ?? []) as Tables<"card_issuers">[],
      products: (products ?? []) as Tables<"card_products">[],
    };
  });
}

// ---------------------------------------------------------------------------
// User cards — identification only, never a card number/CVV/PIN (spec addendum section 15)
// ---------------------------------------------------------------------------

export async function listUserCards() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("user_cards")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw new ActionError(error.message);
    return (data ?? []) as Tables<"user_cards">[];
  });
}

export async function createUserCard(input: UserCardFormInput) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const parsed = userCardFormSchema.parse(input);
    const { data, error } = await supabase
      .from("user_cards")
      .insert({
        household_id: householdId,
        user_id: userId,
        custom_name: parsed.custom_name,
        issuer_id: parsed.issuer_id ?? null,
        card_product_id: parsed.card_product_id ?? null,
        last4: parsed.last4 ?? null,
        network: parsed.network ?? null,
        card_type: parsed.card_type,
        credit_limit: parsed.credit_limit ?? null,
        statement_day: parsed.statement_day ?? null,
        due_day: parsed.due_day ?? null,
        color: parsed.color ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't add the card");
    revalidatePath("/more/payment-methods");
    return data as Tables<"user_cards">;
  });
}

export async function updateUserCard(id: string, rawInput: Partial<UserCardFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("user_cards")
      .update(rawInput)
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the card");
    revalidatePath("/more/payment-methods");
    return data as Tables<"user_cards">;
  });
}

export async function deactivateUserCard(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.from("user_cards").update({ is_active: false }).eq("id", id).eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/payment-methods");
    return { id };
  });
}

// ---------------------------------------------------------------------------
// Bank accounts — identifier only (last 2-4 digits), never a full account number
// ---------------------------------------------------------------------------

export async function listBankAccounts() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw new ActionError(error.message);
    return (data ?? []) as Tables<"bank_accounts">[];
  });
}

export async function createBankAccount(input: BankAccountFormInput) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const parsed = bankAccountFormSchema.parse(input);
    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({ household_id: householdId, user_id: userId, ...parsed })
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't add the bank account");
    revalidatePath("/more/payment-methods");
    return data as Tables<"bank_accounts">;
  });
}

export async function updateBankAccount(id: string, rawInput: Partial<BankAccountFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("bank_accounts")
      .update(rawInput)
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the bank account");
    revalidatePath("/more/payment-methods");
    return data as Tables<"bank_accounts">;
  });
}

export async function deactivateBankAccount(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.from("bank_accounts").update({ is_active: false }).eq("id", id).eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/payment-methods");
    return { id };
  });
}

// ---------------------------------------------------------------------------
// UPI profiles — label only, never a UPI PIN or credential
// ---------------------------------------------------------------------------

export async function listUpiProfiles() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("upi_profiles")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw new ActionError(error.message);
    return (data ?? []) as Tables<"upi_profiles">[];
  });
}

export async function createUpiProfile(input: UpiProfileFormInput) {
  return runAction(async () => {
    const { supabase, userId, householdId } = await requireHouseholdContext();
    const parsed = upiProfileFormSchema.parse(input);
    const { data, error } = await supabase
      .from("upi_profiles")
      .insert({ household_id: householdId, user_id: userId, ...parsed })
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't add the UPI profile");
    revalidatePath("/more/payment-methods");
    return data as Tables<"upi_profiles">;
  });
}

export async function updateUpiProfile(id: string, rawInput: Partial<UpiProfileFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("upi_profiles")
      .update(rawInput)
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the UPI profile");
    revalidatePath("/more/payment-methods");
    return data as Tables<"upi_profiles">;
  });
}

export async function deactivateUpiProfile(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase.from("upi_profiles").update({ is_active: false }).eq("id", id).eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/payment-methods");
    return { id };
  });
}
