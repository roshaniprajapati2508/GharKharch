"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, Trash2, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
  onConfirm: () => Promise<void> | void;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  icon,
  onConfirm,
  confirmDisabled = false,
  children,
}: ConfirmModalProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  const defaultIcon = destructive ? (
    <Trash2 className="h-6 w-6 stroke-[2.2] text-destructive" />
  ) : (
    <HelpCircle className="h-6 w-6 stroke-[2.2] text-brand-primary" />
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-[340px] rounded-3xl p-6 text-center border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col items-center">
        {/* Top Centered Icon Badge */}
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-2 shadow-inner transition-colors ${
            destructive
              ? "bg-destructive/10 border border-destructive/20"
              : "bg-brand-mint dark:bg-brand-primary/20 border border-brand-primary/20"
          }`}
        >
          {icon || defaultIcon}
        </div>

        <DialogHeader className="flex flex-col items-center gap-1.5 text-center sm:text-center">
          <DialogTitle className="text-base font-bold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {children && <div className="w-full my-2 text-left">{children}</div>}

        <div className="mt-5 flex w-full items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="flex-1 rounded-xl h-10 text-xs font-semibold"
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending || confirmDisabled}
            className={`flex-1 rounded-xl h-10 text-xs font-semibold ${
              !destructive
                ? "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm"
                : ""
            }`}
          >
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
