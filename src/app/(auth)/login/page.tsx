"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/password-input";
import { Label } from "@/components/ui/label";
import { motion, fadeInUp } from "@/lib/motion";
import { AuthTransition } from "@/components/shared/auth-transition";
import { useAuthFlow } from "@/lib/hooks/use-auth-flow";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { signInStep, authError, signInWithCredentials, resetAuthFlow } = useAuthFlow();
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    await signInWithCredentials(values);
  }

  async function sendMagicLink() {
    const email = getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      toastError("Enter your email above first");
      return;
    }
    setMagicLinkSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMagicLinkSending(false);
    if (error) {
      toastError("Couldn't send magic link", { description: error.message });
      return;
    }
    toastSuccess("Magic link sent!", "Check your email inbox for the sign-in link.");
    setMagicLinkSent(true);
  }

  const isPending = signInStep !== "idle" || magicLinkSending;

  return (
    <>
      <AuthTransition
        mode="sign-in"
        step={signInStep}
        error={authError}
        onRetry={resetAuthFlow}
        onDismiss={resetAuthFlow}
      />

      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to see where your money went.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isPending}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isPending}
              {...register("password")}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button
            type="submit"
            size="lg"
            loading={signInStep !== "idle"}
            className="mt-1 bg-brand-primary text-white hover:bg-brand-primary/90"
          >
            Sign in
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        {magicLinkSent ? (
          <motion.p
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center text-sm text-brand-primary font-medium"
          >
            Check your email for a sign-in link.
          </motion.p>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            loading={magicLinkSending}
            disabled={isPending}
            onClick={sendMagicLink}
          >
            Email me a magic link
          </Button>
        )}

        <p className="text-center text-sm text-muted-foreground">
          New to GharKharch?{" "}
          <Link href="/signup" className="font-medium text-brand-primary hover:underline">
            Create an account
          </Link>
        </p>
      </motion.div>
    </>
  );
}
