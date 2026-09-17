"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/password-input";
import { Label } from "@/components/ui/label";
import { motion, fadeInUp, successPop } from "@/lib/motion";

const schema = z.object({
  displayName: z.string().min(1, "Tell us what to call you"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error("Couldn't create your account", { description: error.message });
      return;
    }

    if (!data.session) {
      // Email confirmation is required before a session exists.
      setCheckEmail(true);
      return;
    }

    router.replace("/onboarding");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <motion.div variants={successPop} initial="hidden" animate="visible" className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">Confirm your email</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a confirmation link. Open it to finish creating your account, then come back and sign in.
        </p>
        <Link href="/login" className="mt-3 text-sm font-medium text-brand-primary hover:underline">
          Back to sign in
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Takes less than a minute.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Your name</Label>
          <Input id="displayName" placeholder="e.g. Harsh" autoComplete="name" {...register("displayName")} />
          {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" autoComplete="new-password" placeholder="At least 6 characters" {...register("password")} />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" size="lg" loading={submitting} className="mt-1">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-primary hover:underline">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
