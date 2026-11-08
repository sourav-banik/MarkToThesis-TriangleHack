"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { credentialsSchema, safeReturnPath, signupSchema } from "../contracts";
import { profileUpdateSchema } from "@/features/profiles/contracts";
import { notifyAccountChanged, useAccount } from "../use-account";

export function AccountPanel({
  next,
  confirmationFailed,
}: {
  next?: string;
  confirmationFailed?: boolean;
}) {
  const router = useRouter();
  const { account, error: loadError, refresh } = useAccount();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string | null>(
    confirmationFailed
      ? "The confirmation link could not be completed. It may have expired or opened in a different browser. Try signing in or requesting a new account confirmation."
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loadError)
    return (
      <div className="detail-panel">
        <p role="alert">{loadError}</p>
        <Button onClick={() => void refresh()}>Retry account lookup</Button>
      </div>
    );
  if (!account)
    return (
      <p role="status" className="replay-loading">
        Checking your account…
      </p>
    );
  if (!account.configured)
    return (
      <EmptyState
        title="Accounts are not connected in this preview"
        action={
          <Link href="/replay" className={buttonClass()}>
            Explore a synthetic replay
          </Link>
        }
      >
        <p>
          The account and live claim flow is ready to connect. Signing in and saving server records
          become available once this app’s account service is configured.
        </p>
      </EmptyState>
    );

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const candidate = {
      email: form.get("email"),
      password: form.get("password"),
      next: safeReturnPath(next),
      ...(mode === "sign-up" ? { displayName: form.get("displayName") } : {}),
    };
    const parsed = (mode === "sign-up" ? signupSchema : credentialsSchema).safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "This account action could not be completed.");
      if (body.next) {
        notifyAccountChanged();
        router.push(safeReturnPath(body.next));
        router.refresh();
      } else setMessage(body.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const parsed = profileUpdateSchema.safeParse({
      handle: form.get("handle"),
      displayName: form.get("displayName"),
      bio: form.get("bio"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Your profile could not be saved.");
      await refresh();
      notifyAccountChanged();
      setMessage("Public profile saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Sign out could not be completed.");
      await refresh();
      notifyAccountChanged();
      router.refresh();
      setMessage("You are signed out. Saved claims remain in the database.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-panel account-panel">
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="form-message success">
          {message}
        </p>
      )}
      {account.user ? (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">SIGNED IN</span>
              <h2>{account.profile?.displayName ?? "Your account"}</h2>
              <p className="field-help">{account.user.email}</p>
            </div>
            <Button variant="secondary" onClick={signOut} disabled={busy}>
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </Button>
          </div>
          {account.profile && (
            <form onSubmit={saveProfile} key={account.profile.id}>
              <div className="field-group">
                <label htmlFor="profile-name">Public display name</label>
                <input
                  id="profile-name"
                  name="displayName"
                  required
                  maxLength={80}
                  defaultValue={account.profile.displayName}
                />
              </div>
              <div className="field-group">
                <label htmlFor="profile-handle">Public handle</label>
                <input
                  id="profile-handle"
                  name="handle"
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-z0-9_]+"
                  defaultValue={account.profile.handle}
                />
                <p className="field-help">
                  3–40 lowercase letters, numbers, or underscores. Your email is not part of the
                  public profile.
                </p>
              </div>
              <div className="field-group">
                <label htmlFor="profile-bio">Public bio</label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  rows={3}
                  maxLength={500}
                  defaultValue={account.profile.bio}
                />
              </div>
              <div className="form-actions">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save public profile"}
                </Button>
                <Link href="/new" className="text-link">
                  Log a new call <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="filter-tabs profile-tabs" role="group" aria-label="Account action">
            <button
              className={mode === "sign-in" ? "selected" : ""}
              aria-pressed={mode === "sign-in"}
              onClick={() => setMode("sign-in")}
            >
              Sign in
            </button>
            <button
              className={mode === "sign-up" ? "selected" : ""}
              aria-pressed={mode === "sign-up"}
              onClick={() => setMode("sign-up")}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submitAuth}>
            {mode === "sign-up" && (
              <div className="field-group">
                <label htmlFor="signup-name">Public display name</label>
                <input
                  id="signup-name"
                  name="displayName"
                  required
                  maxLength={80}
                  autoComplete="nickname"
                />
              </div>
            )}
            <div className="field-group">
              <label htmlFor="account-email">Email</label>
              <input
                id="account-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                maxLength={254}
              />
            </div>
            <div className="field-group">
              <label htmlFor="account-password">Password</label>
              <input
                id="account-password"
                type="password"
                name="password"
                required
                minLength={8}
                maxLength={256}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              />
              <p className="field-help">
                At least 8 characters. Account confirmation may require an email link.
              </p>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "sign-in" ? "Sign in securely" : "Create account"}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
