"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      // Safe-area aware on mobile (spec section 61, 88) — the fixed offset is
      // additive with the device's own inset, so a toast never sits under a
      // notch or gesture bar on a top-center placement.
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border border-border bg-card text-card-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
