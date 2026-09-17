import { z } from "zod";
import { getTodayISO } from "@/lib/date-utils";

// Spec section 66: validate with Zod, never trust client-side validation alone
// (server actions re-run these same schemas server-side).

export const expenseTypeEnum = z.enum(["personal", "household", "shared"]);
export const paymentMethodEnum = z.enum(["upi", "cash", "credit_card", "debit_card", "bank_transfer", "wallet", "other"]);

export const expenseFormSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than ₹0").max(10_000_000, "That amount looks too large"),
  item_name: z.string().trim().min(1, "Enter an item or merchant name").max(120),
  category_id: z.string().uuid("Choose a category"),
  subcategory_id: z.string().uuid().nullable().optional(),
  merchant_id: z.string().uuid().nullable().optional(),
  paid_by: z.string().uuid("Choose who paid"),
  expense_type: expenseTypeEnum.default("household"),
  payment_method: z.string().trim().max(60).nullable().optional(),
  card_id: z.string().uuid().nullable().optional(),
  upi_profile_id: z.string().uuid().nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .default(() => getTodayISO()),
  expense_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a category name").max(60),
  parent_id: z.string().uuid().nullable().optional(),
  icon: z.string().trim().min(1).max(60).default("circle"),
  color: z.string().trim().min(1).max(30).default("neutral"),
  sort_order: z.coerce.number().int().default(0),
});
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

export const merchantTypeEnum = z.enum([
  "delivery", "grocery", "food", "shopping", "fashion", "electronics",
  "entertainment", "movies", "travel", "fuel", "pharmacy", "utility",
  "local_store", "restaurant", "marketplace", "subscription", "advertising", "other",
]);

export const merchantFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a merchant name").max(120),
  category_id: z.string().uuid().nullable().optional(),
  subcategory_id: z.string().uuid().nullable().optional(),
  merchant_type: merchantTypeEnum.default("other"),
  channel: z.enum(["online", "offline", "mixed"]).default("offline"),
  icon: z.string().trim().max(60).nullable().optional(),
});
export type MerchantFormInput = z.infer<typeof merchantFormSchema>;

export const paymentMethodFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  icon: z.string().trim().min(1).max(60).default("wallet"),
});
export type PaymentMethodFormInput = z.infer<typeof paymentMethodFormSchema>;

export const userCardFormSchema = z.object({
  custom_name: z.string().trim().min(1, "Enter a name for this card").max(80),
  issuer_id: z.string().uuid().nullable().optional(),
  card_product_id: z.string().uuid().nullable().optional(),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter exactly 4 digits")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  network: z.enum(["visa", "mastercard", "rupay", "amex", "diners", "other"]).nullable().optional(),
  card_type: z.enum(["credit", "debit", "prepaid"]).default("credit"),
  credit_limit: z.coerce.number().nonnegative().nullable().optional(),
  statement_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  due_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  color: z.string().trim().max(30).nullable().optional(),
});
export type UserCardFormInput = z.infer<typeof userCardFormSchema>;

export const bankAccountFormSchema = z.object({
  bank_name: z.string().trim().min(1, "Enter a bank name").max(80),
  account_type: z.enum(["savings", "current", "other"]).default("savings"),
  account_last4: z
    .string()
    .trim()
    .regex(/^\d{2,4}$/, "Enter the last 2-4 digits")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  nickname: z.string().trim().max(60).nullable().optional(),
});
export type BankAccountFormInput = z.infer<typeof bankAccountFormSchema>;

export const upiProfileFormSchema = z.object({
  label: z.string().trim().min(1, "Enter a label").max(60),
  upi_app: z.enum(["google_pay", "phonepe", "paytm", "bhim", "bank_upi", "other"]).default("other"),
  linked_bank_name: z.string().trim().max(80).nullable().optional(),
});
export type UpiProfileFormInput = z.infer<typeof upiProfileFormSchema>;
