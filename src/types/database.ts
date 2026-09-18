// Hand-authored to match supabase/migrations/*.sql.
// Regenerate/replace with `supabase gen types typescript` once the project is linked,
// to keep this file guaranteed in sync with the live schema.
// `Relationships: []` on every table is intentional: we don't rely on PostgREST's
// embedded-resource (`table(nested)`) type inference anywhere in the app, so we
// always fetch related rows with a second explicit query instead.

export type ExpenseType = "personal" | "household" | "shared";
export type PaymentMethod = "upi" | "cash" | "credit_card" | "debit_card" | "bank_transfer" | "wallet" | "other";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type HouseholdRole = "owner" | "member";
export type Theme = "light" | "dark" | "system";
export type StartOfWeek = "monday" | "sunday";

// --- Commerce ecosystem (migration 008) ---
export type MerchantType =
  | "delivery" | "grocery" | "food" | "shopping" | "fashion" | "electronics"
  | "entertainment" | "movies" | "travel" | "fuel" | "pharmacy" | "utility"
  | "local_store" | "restaurant" | "marketplace" | "subscription" | "advertising" | "other";
export type MerchantChannel = "online" | "offline" | "mixed";
export type CardNetwork = "visa" | "mastercard" | "rupay" | "amex" | "diners" | "other";
export type CardType = "credit" | "debit" | "prepaid";
export type BankAccountType = "savings" | "current" | "other";
export type UpiApp = "google_pay" | "phonepe" | "paytm" | "bhim" | "bank_upi" | "other";
export type BillType = "electricity" | "gas" | "water" | "internet" | "mobile" | "dth" | "maintenance" | "other";
export type BillStatus = "upcoming" | "due" | "paid" | "overdue" | "cancelled";
export type BillFrequency = "monthly" | "quarterly" | "yearly" | "irregular";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["households"]["Row"], "id" | "created_at" | "updated_at">>;
        Update: Partial<Database["public"]["Tables"]["households"]["Row"]>;
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["household_members"]["Row"], "id" | "joined_at">> & {
          household_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["household_members"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          default_currency: string;
          default_payment_method: string | null;
          default_expense_owner: string | null;
          theme: Theme;
          start_of_week: StartOfWeek;
          dashboard_preferences: Record<string, unknown>;
          quick_add_preferences: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_preferences"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          household_id: string | null;
          parent_id: string | null;
          name: string;
          icon: string;
          color: string;
          type: "expense" | "income";
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at">> & { name: string };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      merchants: {
        Row: {
          id: string;
          household_id: string | null; // null = global/system merchant catalogue entry
          name: string;
          normalized_name: string;
          category_id: string | null;
          subcategory_id: string | null;
          icon: string | null;
          is_active: boolean;
          merchant_type: MerchantType;
          parent_merchant_id: string | null;
          channel: MerchantChannel;
          aliases: string[];
          is_system: boolean;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["merchants"]["Row"], "id" | "created_at" | "updated_at">> & {
          name: string;
          normalized_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["merchants"]["Row"]>;
        Relationships: [];
      };
      recurring_expenses: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          name: string;
          amount: string; // numeric comes back as string over PostgREST
          category_id: string;
          merchant_id: string | null;
          frequency: RecurringFrequency;
          next_due_date: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["recurring_expenses"]["Row"], "id" | "created_at" | "updated_at" | "amount">> & {
          household_id: string;
          created_by: string;
          name: string;
          amount: string | number;
          category_id: string;
          frequency: RecurringFrequency;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["recurring_expenses"]["Row"], "amount">> & {
          amount?: string | number;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          paid_by: string;
          expense_type: ExpenseType;
          amount: string;
          currency: string;
          merchant_id: string | null;
          item_name: string;
          category_id: string;
          subcategory_id: string | null;
          payment_method: string | null; // free text, matches a payment_methods.name (see migration 005) — not a fixed enum
          card_id: string | null;
          upi_profile_id: string | null;
          bank_account_id: string | null;
          expense_date: string;
          expense_time: string | null;
          notes: string | null;
          is_recurring: boolean;
          recurring_rule_id: string | null;
          /** Storage object path inside the private `receipts` bucket (e.g. "{household_id}/{uuid}.jpg"), or null — never a URL, since the bucket is private and a stored URL would go stale (migration 017). */
          receipt_path: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          /** "expense" (default) or "income" - migration 022. Only meaningful for Homemade Business entries; every other row stays "expense". */
          entry_type: "expense" | "income";
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["expenses"]["Row"], "id" | "created_at" | "updated_at" | "amount">> & {
          household_id: string;
          created_by: string;
          paid_by: string;
          amount: string | number;
          item_name: string;
          category_id: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["expenses"]["Row"], "amount">> & {
          amount?: string | number;
        };
        Relationships: [];
      };
      expense_patterns: {
        Row: {
          id: string;
          household_id: string;
          user_id: string | null;
          merchant_id: string | null;
          item_name: string | null;
          category_id: string;
          subcategory_id: string | null;
          frequency_score: number;
          last_used_at: string | null;
          usage_count: number;
          average_amount: string | null;
          amount_min: string | null;
          amount_max: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["expense_patterns"]["Row"], "id" | "created_at" | "updated_at">> & {
          household_id: string;
          category_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["expense_patterns"]["Row"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          household_id: string;
          category_id: string | null;
          person_id: string | null;
          period_month: string;
          amount: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["budgets"]["Row"], "id" | "created_at" | "updated_at" | "amount">> & {
          household_id: string;
          period_month: string;
          amount: string | number;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["budgets"]["Row"], "amount">> & {
          amount?: string | number;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          icon: string;
          is_default: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["payment_methods"]["Row"], "id" | "created_at" | "updated_at">> & {
          household_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]>;
        Relationships: [];
      };
      card_issuers: {
        Row: { id: string; name: string; logo_url: string | null; is_active: boolean; created_at: string };
        Insert: Partial<Omit<Database["public"]["Tables"]["card_issuers"]["Row"], "id" | "created_at">> & { name: string };
        Update: Partial<Database["public"]["Tables"]["card_issuers"]["Row"]>;
        Relationships: [];
      };
      card_products: {
        Row: {
          id: string;
          issuer_id: string;
          name: string;
          variant: string | null;
          network: CardNetwork | null;
          card_type: CardType;
          default_credit_limit: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["card_products"]["Row"], "id" | "created_at">> & {
          issuer_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["card_products"]["Row"]>;
        Relationships: [];
      };
      user_cards: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          issuer_id: string | null;
          card_product_id: string | null;
          custom_name: string;
          last4: string | null;
          network: CardNetwork | null;
          card_type: CardType;
          credit_limit: string | null;
          statement_day: number | null;
          due_day: number | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["user_cards"]["Row"], "id" | "created_at" | "updated_at" | "credit_limit">> & {
          household_id: string;
          user_id: string;
          custom_name: string;
          credit_limit?: string | number | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["user_cards"]["Row"], "credit_limit">> & {
          credit_limit?: string | number | null;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          bank_name: string;
          account_type: BankAccountType;
          account_last4: string | null;
          nickname: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["bank_accounts"]["Row"], "id" | "created_at" | "updated_at">> & {
          household_id: string;
          user_id: string;
          bank_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_accounts"]["Row"]>;
        Relationships: [];
      };
      upi_profiles: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          label: string;
          upi_app: UpiApp;
          linked_bank_name: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["upi_profiles"]["Row"], "id" | "created_at" | "updated_at">> & {
          household_id: string;
          user_id: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["upi_profiles"]["Row"]>;
        Relationships: [];
      };
      bill_providers: {
        Row: {
          id: string;
          household_id: string | null;
          name: string;
          provider_type: BillType;
          state: string | null;
          logo_url: string | null;
          is_system: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["bill_providers"]["Row"], "id" | "created_at">> & {
          name: string;
          provider_type: BillType;
        };
        Update: Partial<Database["public"]["Tables"]["bill_providers"]["Row"]>;
        Relationships: [];
      };
      bills: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          provider_id: string | null;
          bill_type: BillType;
          amount: string;
          billing_period_start: string | null;
          billing_period_end: string | null;
          due_date: string | null;
          paid_date: string | null;
          payment_method: string | null;
          card_id: string | null;
          status: BillStatus;
          is_recurring: boolean;
          recurring_frequency: BillFrequency | null;
          linked_expense_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["bills"]["Row"], "id" | "created_at" | "updated_at" | "amount">> & {
          household_id: string;
          created_by: string;
          bill_type: BillType;
          amount: string | number;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["bills"]["Row"], "amount">> & {
          amount?: string | number;
        };
        Relationships: [];
      };
      household_hidden_categories: {
        Row: { household_id: string; category_id: string; hidden_at: string };
        Insert: { household_id: string; category_id: string };
        Update: Partial<{ household_id: string; category_id: string }>;
        Relationships: [];
      };
      household_hidden_merchants: {
        Row: { household_id: string; merchant_id: string; hidden_at: string };
        Insert: { household_id: string; merchant_id: string };
        Update: Partial<{ household_id: string; merchant_id: string }>;
        Relationships: [];
      };
      household_hidden_automation_rules: {
        Row: { household_id: string; rule_id: string; hidden_at: string };
        Insert: { household_id: string; rule_id: string };
        Update: Partial<{ household_id: string; rule_id: string }>;
        Relationships: [];
      };
      scratchpad_drafts: {
        Row: { household_id: string; content: string; updated_at: string };
        Insert: { household_id: string; content?: string; updated_at?: string };
        Update: Partial<{ household_id: string; content: string; updated_at: string }>;
        Relationships: [];
      };
      automation_rules: {
        Row: {
          id: string;
          household_id: string | null; // null = global default rule (migration 024)
          name: string;
          priority: number;
          is_active: boolean;
          conditions: {
            keywords: string[];
            min_amount: number | null;
            max_amount: number | null;
            entry_type: "expense" | "income" | null;
            time_of_day: string | null;
          };
          actions: {
            category_name: string | null;
            subcategory_name: string | null;
            merchant_name: string | null;
            payment_method: string | null;
            paid_by_name: string | null;
            entry_type: "expense" | "income" | null;
          };
          execution_count: number;
          last_executed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["automation_rules"]["Row"], "id" | "created_at" | "execution_count">> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["automation_rules"]["Row"]>;
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          household_id: string;
          actor_id: string | null;
          event_type: string; // 'expense_created' | 'expense_updated' | 'expense_deleted' | 'rule_triggered' | 'budget_alert' | ...
          entity_type: string | null; // 'expense' | 'merchant' | 'rule' | 'budget' | null
          entity_id: string | null;
          summary: string;
          metadata: Record<string, unknown>;
          is_alert: boolean;
          read_by: string[];
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["activity_events"]["Row"], "id" | "created_at" | "read_by">> & {
          household_id: string;
          event_type: string;
          summary: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_events"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: { p_name?: string };
        Returns: string;
      };
      get_spending_pace_benchmark: {
        Args: { p_household_id: string; p_current_date?: string };
        Returns: {
          current_day: number;
          days_in_month: number;
          month_progress_pct: string;
          current_mtd_spend: string;
          projected_month_end: string;
          avg_3m_mtd_spend: string;
          avg_6m_mtd_spend: string;
          avg_12m_mtd_spend: string;
          pace_vs_6m_pct: string;
          pace_status: "frugal" | "on_track" | "elevated";
        }[];
      };
      mark_activity_read: {
        Args: { p_event_id: string };
        Returns: void;
      };
      mark_all_activity_read: {
        Args: { p_household_id: string };
        Returns: void;
      };
      join_household_by_code: {
        Args: { p_code: string };
        Returns: string;
      };
      is_household_member: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      get_business_pnl: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: {
          income_total: string;
          expense_total: string;
          net_profit: string;
          income_count: number;
          expense_count: number;
        }[];
      };
      get_income_summary: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: {
          category_id: string;
          category_name: string;
          total: string;
          txn_count: number;
        }[];
      };
      get_expense_summary: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_paid_by?: string | null; p_category_scope?: string | null };
        Returns: {
          total: string;
          txn_count: number;
          avg_transaction: string;
          days: number;
          largest_amount: string | null;
          largest_expense_id: string | null;
        }[];
      };
      get_category_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_paid_by?: string | null; p_category_scope?: string | null };
        Returns: {
          category_id: string;
          category_name: string;
          icon: string;
          color: string;
          parent_id: string | null;
          total: string;
          txn_count: number;
          avg_transaction: string;
          highest_transaction: string;
          lowest_transaction: string;
        }[];
      };
      get_person_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_category_scope?: string | null };
        Returns: { paid_by: string; total: string; txn_count: number; avg_transaction: string }[];
      };
      get_merchant_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_limit?: number; p_category_scope?: string | null };
        Returns: {
          merchant_id: string;
          merchant_name: string;
          total: string;
          txn_count: number;
          avg_transaction: string;
          highest_transaction: string;
          lowest_transaction: string;
          last_expense_date: string;
          share_pct: string;
        }[];
      };
      get_merchant_monthly_trend: {
        Args: { p_household_id: string; p_merchant_id: string; p_months?: number };
        Returns: { month: string; total: string }[];
      };
      get_item_analytics: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_limit?: number; p_category_scope?: string | null };
        Returns: {
          item_name: string;
          txn_count: number;
          total: string;
          avg_amount: string;
          first_date: string;
          last_date: string;
          avg_gap_days: string | null;
          estimated_monthly_spend: string;
        }[];
      };
      get_payment_method_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_category_scope?: string | null };
        Returns: { payment_method: string; total: string; txn_count: number; share_pct: string }[];
      };
      get_daily_spending: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_paid_by?: string | null; p_category_scope?: string | null };
        Returns: { expense_date: string; total: string; txn_count: number }[];
      };
      get_top_expenses: {
        Args: { p_household_id: string; p_start: string; p_end: string; p_limit?: number };
        Returns: {
          id: string;
          item_name: string;
          amount: string;
          expense_date: string;
          category_id: string;
          merchant_id: string | null;
          paid_by: string;
        }[];
      };
      get_category_monthly_trend: {
        Args: { p_household_id: string; p_category_id: string; p_months?: number };
        Returns: { month: string; total: string }[];
      };
      get_merchant_category_share: {
        Args: { p_household_id: string; p_merchant_id: string; p_start: string; p_end: string };
        Returns: {
          category_id: string;
          category_name: string;
          merchant_total_in_category: string;
          category_total: string;
          category_share_pct: string;
        }[];
      };
      get_spending_by_weekday: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: { weekday_num: number; total: string; txn_count: number }[];
      };
      get_expense_type_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: { expense_type: string; total: string; txn_count: number; share_pct: string }[];
      };
      get_recurring_vs_oneoff: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: { recurring_total: string; recurring_count: number; oneoff_total: string; oneoff_count: number }[];
      };
      get_card_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: { card_id: string; card_label: string; last4: string | null; total: string; txn_count: number }[];
      };
      get_upi_breakdown: {
        Args: { p_household_id: string; p_start: string; p_end: string };
        Returns: { upi_profile_id: string; label: string; upi_app: string; total: string; txn_count: number }[];
      };
      get_item_weekday_affinity: {
        Args: { p_household_id: string; p_weekday: number; p_lookback_days?: number; p_min_txn?: number };
        Returns: { item_name: string; weekday_txn_count: number; total_txn_count: number; affinity: string }[];
      };
      get_item_gap_consistency: {
        Args: { p_household_id: string; p_lookback_days?: number; p_min_txn?: number };
        Returns: {
          item_name: string;
          txn_count: number;
          avg_gap_days: string;
          gap_stddev_days: string;
          last_date: string;
          avg_amount: string;
          merchant_id: string | null;
          category_id: string | null;
          subcategory_id: string | null;
        }[];
      };
      get_category_merge_impact: {
        Args: { p_duplicate_id: string };
        Returns: { expense_count: number; merchant_count: number; child_category_count: number };
      };
      get_merchant_merge_impact: {
        Args: { p_duplicate_id: string };
        Returns: { expense_count: number; child_merchant_count: number };
      };
      merge_categories: {
        Args: { p_canonical_id: string; p_duplicate_id: string };
        Returns: { canonical_id: string; duplicate_id: string; expenses_reassigned: number };
      };
      merge_merchants: {
        Args: { p_canonical_id: string; p_duplicate_id: string };
        Returns: { canonical_id: string; duplicate_id: string; expenses_reassigned: number };
      };
      find_duplicate_categories: {
        Args: { p_household_id: string };
        Returns: { name_key: string; category_ids: string[]; category_names: string[]; household_scoped: boolean; is_global: boolean[] }[];
      };
      find_duplicate_merchants: {
        Args: { p_household_id: string };
        Returns: { name_key: string; merchant_ids: string[]; merchant_names: string[]; household_scoped: boolean; is_global: boolean[] }[];
      };
      customize_category: {
        Args: { p_global_id: string; p_household_id: string; p_name?: string | null; p_icon?: string | null; p_color?: string | null };
        Returns: Database["public"]["Tables"]["categories"]["Row"];
      };
      customize_merchant: {
        Args: { p_global_id: string; p_household_id: string; p_name?: string | null; p_icon?: string | null };
        Returns: Database["public"]["Tables"]["merchants"]["Row"];
      };
      hide_global_category: {
        Args: { p_category_id: string; p_household_id: string };
        Returns: void;
      };
      hide_global_merchant: {
        Args: { p_merchant_id: string; p_household_id: string };
        Returns: void;
      };
      get_spending_intelligence_bundle: {
        Args: {
          p_household_id: string;
          p_start: string;
          p_end: string;
          p_prev_start: string;
          p_prev_end: string;
          p_month_start: string;
          p_month_end: string;
          p_prev_month_start: string;
          p_prev_month_end: string;
        };
        Returns: {
          summary: { total: number; txn_count: number; avg_transaction: number };
          weekday_rows: { weekday_num: number; total: number; txn_count: number }[];
          daily_rows: { expense_date: string; total: number; txn_count: number }[];
          expense_type_rows: { expense_type: string; total: number; txn_count: number; share_pct: number }[];
          person_rows: { paid_by: string; name: string; total: number; txn_count: number; avg_transaction: number }[];
          recurring_row: { recurring_total: number; recurring_count: number; oneoff_total: number; oneoff_count: number };
          merchant_current_rows: { merchant_id: string; merchant_name: string; total: number }[];
          merchant_prev_rows: { merchant_id: string; merchant_name: string; total: number }[];
          item_current_rows: { item_name: string; total: number }[];
          item_prev_rows: { item_name: string; total: number }[];
          category_month_rows: { category_id: string; category_name: string; total: number }[];
          category_prev_month_rows: { category_id: string; category_name: string; total: number }[];
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
