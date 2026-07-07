import React, { useState } from "react";
import { Target } from "lucide-react";
import { useLogin, type ApiMessage } from "@workspace/api-client-react";
import { useInvalidateMe } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidateMe = useInvalidateMe();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        setError(null);
        track("login");
        invalidateMe();
      },
      onError: (err) => {
        const message =
          (err as ApiMessage | undefined)?.message ??
          "Login failed. Please try again.";
        setError(message);
      },
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Target size={20} strokeWidth={3} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">VacancyMatch</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered candidate-to-job matching
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your workspace credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                />
              </div>
              {error && (
                <p
                  className="text-sm text-destructive"
                  data-testid="text-login-error"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-xs text-center text-muted-foreground">
          Demo accounts: owner@demo.test, admin@demo.test, recruiter@demo.test,
          viewer@demo.test (password: demo1234)
        </p>
      </div>
    </div>
  );
}
