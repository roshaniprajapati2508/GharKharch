// Thin, consistent wrappers over sonner's `toast` (spec section 61: "Create a
// consistent global toast system"). Existing call sites using `toast.success`
// / `toast.error` directly from "sonner" keep working — these helpers exist
// for the newer interactions that need an icon-prefixed message, an undo
// action, or a retry action, so that pattern stays identical everywhere it's
// used rather than each component inventing its own toast shape.

import { toast } from "sonner";

export function toastSuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

export function toastError(message: string, opts?: { description?: string; onRetry?: () => void }) {
  toast.error(message, {
    description: opts?.description,
    action: opts?.onRetry ? { label: "Retry", onClick: opts.onRetry } : undefined,
  });
}

/** "Expense deleted [Undo]" pattern (spec section 12). `onUndo` restores the item; the toast auto-dismisses. */
export function toastUndo(message: string, onUndo: () => void, description?: string) {
  toast(message, {
    description,
    action: { label: "Undo", onClick: onUndo },
    duration: 5000,
  });
}
