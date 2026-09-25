"use client";

import { ConfirmModal, type ConfirmModalProps } from "./confirm-modal";

/**
 * ConfirmationDialog component (re-exports and delegates to ConfirmModal).
 * Preserves backwards compatibility for existing call sites across budgets, categories,
 * merchants, payment methods, recurring rules, and expense lists.
 */
export function ConfirmationDialog(props: ConfirmModalProps) {
  return <ConfirmModal {...props} />;
}
