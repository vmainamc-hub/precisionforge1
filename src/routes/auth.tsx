import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — Precision Edge trading intelligence" },
      {
        name: "description",
        content:
          "Sign in to Precision Edge to reach the Sentinel scanner, your Deriv accounts, signals, journal and learned market intelligence.",
      },
      { property: "og:title", content: "Sign in — Precision Edge trading intelligence" },
      {
        property: "og:description",
        content:
          "Sign in to reach the Sentinel scanner, your signals and your learned market intelligence.",
      },
    ],
  }),
  component: AuthPage,
});

/** Only same-origin relative paths may be used as a post-login destination. */
function safePath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app/dashboard";
  return value;
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const next = safePath(redirect);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void navigate({ to: next, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void navigate({ to: next, replace: true });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        toast.success("Account created — check your inbox if confirmation is required.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      sessionStorage.setItem("auth:next", next);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if ("error" in result && result.error) {
        toast.error("Google sign-in failed");
        return;
      }
      if ("redirected" in result && result.redirected) return;
      void navigate({ to: next, replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass w-full max-w-md rounded-xl border border-border/50 p-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[var(--neon)] to-[var(--accent)]">
            <Shield className="h-4 w-4 text-background" />
          </span>
          <span className="font-display text-lg font-bold">Precision Edge</span>
        </Link>

        <h1 className="mt-6 font-display text-2xl font-bold">
          {mode === "signin" ? "Sign in to your terminal" : "Create your terminal account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Deriv accounts, signals, journal and everything Sentinel learns are stored against
          your account.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border/60" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            or
          </span>
          <span className="h-px flex-1 bg-border/60" />
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-[var(--neon)] underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
