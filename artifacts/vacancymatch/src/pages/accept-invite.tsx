import React, { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useLookupInvite,
  useAcceptInvite,
  getLookupInviteQueryKey,
  type ApiMessage,
} from "@workspace/api-client-react";
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Target size={20} strokeWidth={3} />
          </div>
          <h1 className="font-serif text-xl font-medium tracking-tight">VacancyMatch</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AcceptInvite() {
  const search = useSearch();
  const token = useMemo(
    () => new URLSearchParams(search).get("token") ?? "",
    [search],
  );
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidateMe = useInvalidateMe();
  const [, navigate] = useLocation();

  const lookup = useLookupInvite(
    { token },
    {
      query: {
        queryKey: getLookupInviteQueryKey({ token }),
        enabled: token.length > 0,
        retry: false,
      },
    },
  );

  const acceptMutation = useAcceptInvite({
    mutation: {
      onSuccess: () => {
        setError(null);
        track("invite_accepted");
        navigate("/");
        invalidateMe();
      },
      onError: (err) => {
        setError(
          (err as ApiMessage | undefined)?.message ??
            "Could not accept the invite. Please try again.",
        );
      },
    },
  });

  if (!token || lookup.isError) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>
              This invite link is invalid, expired, or has already been used.
              Ask your workspace admin to send a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-go-login">
                Go to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (lookup.isLoading || !lookup.data) {
    return (
      <Shell>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Shell>
    );
  }

  const invite = lookup.data;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    acceptMutation.mutate({ data: { token, fullName: fullName.trim(), password } });
  };

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Join {invite.tenantName}</CardTitle>
          <CardDescription>
            {invite.invitedByName} invited you ({invite.email}) to join as{" "}
            <span className="font-medium">{invite.role}</span>. Choose a
            password to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input id="inviteEmail" value={invite.email} disabled data-testid="input-invite-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-full-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-accept-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={acceptMutation.isPending}
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? "Joining…" : "Accept invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}
