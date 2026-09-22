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

export interface ScratchpadSuggestion {
  id: string;
  label: string;
  template: string;
  categoryName?: string;
  source: "history" | "business" | "household" | "income";
}

/** Fetches smart quick-add suggestions for Scratchpad: dynamic top frequent items from real household history, plus dedicated homemade business and daily templates. */
export async function getScratchpadQuickSuggestions() {
  return runAction(async (): Promise<{
    historySuggestions: ScratchpadSuggestion[];
    businessSuggestions: ScratchpadSuggestion[];
    householdSuggestions: ScratchpadSuggestion[];
    incomeSuggestions: ScratchpadSuggestion[];
  }> => {
    const { supabase, householdId } = await requireHouseholdContext();

    // 1. Fetch recent expenses for the household to extract most repeated patterns
    const { data: rawExpenses } = await supabase
      .from("expenses")
      .select("item_name, amount, payment_method, entry_type, category_id, merchant_id")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(150);

    const historySuggestions: ScratchpadSuggestion[] = [];

    if (rawExpenses && rawExpenses.length > 0) {
      const counts = new Map<string, { count: number; latestAmount: number; paymentMethod: string; entryType: string }>();

      for (const exp of rawExpenses) {
        const rawName = (exp.item_name || "").trim();
        if (!rawName) continue;
        const key = rawName.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, {
            count: 1,
            latestAmount: Number(exp.amount || 0),
            paymentMethod: exp.payment_method || "UPI",
            entryType: exp.entry_type || "expense",
          });
        }
      }

      // Sort by frequency
      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8);

      for (const [key, meta] of sorted) {
        const capName = key.charAt(0).toUpperCase() + key.slice(1);
        const amountStr = meta.latestAmount > 0 ? ` ${Math.round(meta.latestAmount)}` : "";
        const methodStr = meta.paymentMethod ? ` ${meta.paymentMethod.toLowerCase()}` : "";
        const incomeStr = meta.entryType === "income" ? " income" : "";
        const template = `${capName}${amountStr}${methodStr}${incomeStr}`.trim();

        historySuggestions.push({
          id: `hist-${key}`,
          label: `${capName}${amountStr ? ` (₹${Math.round(meta.latestAmount)})` : ""}`,
          template,
          source: "history",
        });
      }
    }

    // 2. Curated Homemade Business suggestions
    const businessSuggestions: ScratchpadSuggestion[] = [
      { id: "biz-xerox", label: "📄 Satyam Xerox", template: "Satyam Xerox 150 upi Harsh", source: "business" },
      { id: "biz-courier", label: "🚚 Shiprocket Courier", template: "Shiprocket courier 250 upi Harsh", source: "business" },
      { id: "biz-packaging", label: "📦 Packaging Boxes", template: "Packaging boxes 600 upi Harsh", source: "business" },
      { id: "biz-ads", label: "📢 Meta Ads Spend", template: "Meta ads spend 500 upi Harsh", source: "business" },
      { id: "biz-material", label: "🎨 Craft Raw Material", template: "Craft raw material 1200 upi", source: "business" },
      { id: "biz-mehndi-books", label: "📖 Roshni Mehndi Books", template: "Roshni mehndi books 1500 upi Roshni", source: "business" },
      { id: "biz-mehndi-cones", label: "🌿 Nilgiri & Cone Sheets", template: "Nilgiri oil & cone sheets 350 upi Roshni", source: "business" },
      { id: "biz-stationery", label: "📑 Business Stationery", template: "Business stationery 400 upi", source: "business" },
    ];

    // 3. Curated Household & Living suggestions
    const householdSuggestions: ScratchpadSuggestion[] = [
      { id: "hh-dmart", label: "🛒 Dmart Groceries", template: "Dmart grocery 1400 upi", source: "household" },
      { id: "hh-milk", label: "🥛 Amul Milk", template: "Doodh 60 amul upi", source: "household" },
      { id: "hh-veggies", label: "🥦 Sabzi & Bhaji", template: "Sabzi veggies 150 cash", source: "household" },
      { id: "hh-auto", label: "🛺 Auto Rickshaw", template: "Auto rickshaw 50 upi", source: "household" },
      { id: "hh-chai", label: "☕ Chai & Snacks", template: "Chai snacks 40 cash", source: "household" },
      { id: "hh-swiggy", label: "🍔 Swiggy / Zomato", template: "Swiggy food 350 upi", source: "household" },
      { id: "hh-dominos", label: "🍕 Domino's Pizza", template: "Dominos pizza 450 upi", source: "household" },
      { id: "hh-recharge", label: "📱 Mobile Recharge", template: "Mobile recharge 299 upi", source: "household" },
      { id: "hh-maid", label: "🧹 Maid / Help", template: "Maid salary 3000 bank", source: "household" },
    ];

    // 4. Curated Income & Marketplace Payout suggestions
    const incomeSuggestions: ScratchpadSuggestion[] = [
      { id: "inc-meesho", label: "💰 Meesho Seller Payout", template: "Meesho seller payout 3500 income", source: "income" },
      { id: "inc-amazon", label: "📦 Amazon Seller Payout", template: "Amazon seller payout 4500 income", source: "income" },
      { id: "inc-flipkart", label: "🛍️ Flipkart Seller Payout", template: "Flipkart seller payout 3200 income", source: "income" },
      { id: "inc-mehndi", label: "🎨 Bridal Mehndi Client", template: "Bridal mehndi client booking 5000 income Roshni", source: "income" },
      { id: "inc-salary", label: "💼 Monthly Salary", template: "Monthly salary 50000 income bank Harsh", source: "income" },
      { id: "inc-cashback", label: "🎁 Credit Card Cashback", template: "Card cashback 250 income", source: "income" },
    ];

    return {
      historySuggestions,
      businessSuggestions,
      householdSuggestions,
      incomeSuggestions,
    };
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
