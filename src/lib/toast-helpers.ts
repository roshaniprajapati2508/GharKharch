"use client";

import React from "react";
import { toast as sonnerToast } from "sonner";
import { Toast, type ToastTone } from "@/components/shared/toast";

export interface ToastHelperOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onRetry?: () => void;
}

/**
 * Renders a luxury floating branded toast notification
 * matching the GharKharch design system and color palette.
 */
export function showToast(
  message: string,
  tone: ToastTone = "success",
  options?: ToastHelperOptions
) {
  const duration =
    options?.duration ?? (tone === "error" ? 5000 : tone === "loading" ? Infinity : 3500);

  const action = options?.action
    ? options.action
    : options?.onRetry
    ? { label: "Retry", onClick: options.onRetry }
    : undefined;

  return sonnerToast.custom(
    (id) =>
      React.createElement(Toast, {
        id,
        message,
        description: options?.description,
        tone,
        duration,
        action,
        onDismiss: () => sonnerToast.dismiss(id),
      }),
    { duration }
  );
}

export function toastSuccess(
  message: string,
  descriptionOrOpts?: string | ToastHelperOptions
) {
  const opts: ToastHelperOptions =
    typeof descriptionOrOpts === "string"
      ? { description: descriptionOrOpts }
      : descriptionOrOpts || {};
  return showToast(message, "success", opts);
}

export function toastError(
  message: string,
  opts?: { description?: string; onRetry?: () => void; duration?: number }
) {
  return showToast(message, "error", opts);
}

export function toastWarning(message: string, description?: string) {
  return showToast(message, "warning", { description });
}

export function toastInfo(message: string, description?: string) {
  return showToast(message, "info", { description });
}

export function toastLoading(message: string, description?: string) {
  return showToast(message, "loading", { description });
}

/**
 * "Record updated [Undo]" pattern.
 * Displays a branded toast with an interactive Undo button and auto-dismiss timer.
 */
export function toastUndo(
  message: string,
  onUndo: () => void,
  description?: string
) {
  return showToast(message, "info", {
    description,
    duration: 5500,
    action: {
      label: "Undo",
      onClick: onUndo,
    },
  });
}

export function toastDismiss(id?: string | number) {
  sonnerToast.dismiss(id);
}

export { sonnerToast as toast };
