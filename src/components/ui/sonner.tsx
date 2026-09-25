"use client";

import { ToastProvider, type ToastProviderProps } from "@/components/shared/toast-provider";

const Toaster = (props: ToastProviderProps) => {
  return <ToastProvider {...props} />;
};

export { Toaster };
