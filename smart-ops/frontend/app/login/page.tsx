"use client";

import { useState, type FormEvent } from "react";
import { Waves, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogin, isApiError } from "@/lib/hooks/use-auth";

const DEMO_PASSWORD = "Password123!";

// The picker below only shows the person's name, not their email.
const DEMO_ACCOUNTS = [
  { name: "Admin", email: "admin@smart-ops.co.uk" },
  { name: "Harshil", email: "hkotecha@kwale-group.com" },
  { name: "Benson", email: "bnzuka@usm.co.ke" },
  { name: "Pedro", email: "hpedro@usm.co.ke" },
  { name: "Suresh", email: "ssuresh@kwale-group.com" },
  { name: "Liam", email: "liam@smart-ops.co.uk" },
  { name: "Yatin", email: "yatin@smart-ops.co.uk" },
  { name: "Minesh", email: "minesh@smart-ops.co.uk" },
  { name: "Priyesh", email: "priyesh@dinsav.com" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const login = useLogin();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  }

  const errorMessage = login.isError
    ? isApiError(login.error)
      ? login.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,theme(colors.blue.100),transparent_45%),radial-gradient(circle_at_80%_0%,theme(colors.blue.50),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_20%,theme(colors.blue.950),transparent_45%),radial-gradient(circle_at_80%_0%,theme(colors.slate.900),transparent_40%)]"
      />

      <Card className="glass-panel relative z-10 w-full max-w-sm shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Waves className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Smart Ops Portal</CardTitle>
          <CardDescription>Smart Ops — sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@organization.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {errorMessage ? (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-5 rounded-md bg-muted/60 text-xs">
            <button
              type="button"
              onClick={() => setShowDemoAccounts((v) => !v)}
              className="flex w-full items-center justify-between p-2.5 font-medium text-muted-foreground"
            >
              <span>Team logins (password: {DEMO_PASSWORD})</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showDemoAccounts ? "rotate-180" : ""}`}
              />
            </button>
            {showDemoAccounts ? (
              <div className="border-t px-2.5 pb-2.5 pt-1.5">
                <p className="mb-1.5 px-1.5 text-[11px] text-muted-foreground">
                  Click a name to sign in.
                </p>
                <ul className="grid grid-cols-2 gap-0.5">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account.email}>
                      <button
                        type="button"
                        onClick={() => fillDemoAccount(account.email)}
                        className="w-full rounded px-1.5 py-1 text-left text-foreground hover:bg-background"
                      >
                        {account.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
