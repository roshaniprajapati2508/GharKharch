"use server";

import { revalidatePath } from "next/cache";
import { paymentMethodFormSchema, type PaymentMethodFormInput } from "@/lib/validations/expense";
import { requireHouseholdContext, runAction, ActionError } from "@/lib/actions/auth-helpers";
import type { Tables } from "@/types/database";

export async function listPaymentMethodsForHousehold() {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new ActionError(error.message);
    return (data ?? []) as Tables<"payment_methods">[];
  });
}

export async function createPaymentMethod(input: PaymentMethodFormInput) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const parsed = paymentMethodFormSchema.parse(input);
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ household_id: householdId, name: parsed.name, icon: parsed.icon, is_default: false })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new ActionError("You already have a payment method with that name");
      throw new ActionError(error.message);
    }
    revalidatePath("/more/payment-methods");
    return data as Tables<"payment_methods">;
  });
}

export async function updatePaymentMethod(id: string, rawInput: Partial<PaymentMethodFormInput>) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { data, error } = await supabase
      .from("payment_methods")
      .update(rawInput)
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();
    if (error || !data) throw new ActionError(error?.message ?? "Couldn't update the payment method");
    revalidatePath("/more/payment-methods");
    return data as Tables<"payment_methods">;
  });
}

export async function deactivatePaymentMethod(id: string) {
  return runAction(async () => {
    const { supabase, householdId } = await requireHouseholdContext();
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_active: false })
      .eq("id", id)
      .eq("household_id", householdId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/more/payment-methods");
    return { id };
  });
}
