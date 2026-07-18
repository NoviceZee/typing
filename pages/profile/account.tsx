"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { AlertTriangle, Bell, DatabaseZap, KeyRound, UserRound, X } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ProfilePageLayout } from "@/components/ProfilePageLayout";
import { IconButton } from "@/components/SecondaryNavigation";
import { useAuth } from "@/components/AuthProvider";
import {
  SupabaseProfile,
  canChangeHandle,
  changeSupabaseProfileHandle,
  getNextHandleChangeAt,
  getSupabaseProfile
} from "@/lib/profileStorage";
import { deleteCurrentUserAccount, deleteCurrentUserStats, updateCurrentUserPassword } from "@/lib/accountStorage";
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings, readNotificationSettings, writeNotificationSettings } from "@/lib/notificationSettings";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, signOut } = useAuth();
  const recoveryQuery = Array.isArray(router.query?.recovery) ? router.query.recovery[0] : router.query?.recovery;
  const isRecoveryMode = router.isReady && recoveryQuery === "1";
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [handleDraft, setHandleDraft] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [statsConfirmation, setStatsConfirmation] = useState("");
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<"handle" | "password" | "stats" | "delete" | null>(null);
  const [accountDialog, setAccountDialog] = useState<"handle" | "password" | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const newPasswordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!router.isReady || isAuthLoading || user || isRecoveryMode) return;
    void router.push("/login?redirectTo=/profile/account");
  }, [isAuthLoading, isRecoveryMode, router, user]);
  useEffect(() => {
    setNotificationSettings(readNotificationSettings());
  }, []);
  useEffect(() => {
    let mounted = true;
    if (!user) { setProfile(null); setIsProfileLoading(false); return; }
    setIsProfileLoading(true);
    getSupabaseProfile(user.id).then((next) => {
      if (!mounted) return;
      setProfile(next);
      setHandleDraft(next?.handle ?? "");
      setIsProfileLoading(false);
    }).catch((reason) => { if (mounted) { setError(reason instanceof Error ? reason.message : "Profile could not be loaded."); setIsProfileLoading(false); } });
    return () => { mounted = false; };
  }, [user]);

  function begin(action: "handle" | "password" | "stats" | "delete") { setMessage(""); setError(""); setPendingAction(action); }

  function openAccountDialog(dialog: "handle" | "password") {
    setMessage("");
    setError("");
    if (dialog === "handle") setHandleDraft(profile?.handle ?? "");
    if (dialog === "password") {
      setNewPassword("");
      setConfirmPassword("");
    }
    setAccountDialog(dialog);
  }

  function closeAccountDialog() {
    if (pendingAction) return;
    setAccountDialog(null);
    setError("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function clearPasswordFields() {
    setNewPassword("");
    setConfirmPassword("");
    if (newPasswordInputRef.current) newPasswordInputRef.current.value = "";
    if (confirmPasswordInputRef.current) confirmPasswordInputRef.current.value = "";
  }

  async function saveHandle(event: FormEvent) {
    event.preventDefault();
    begin("handle");
    try {
      const next = await changeSupabaseProfileHandle(handleDraft);
      setProfile(next);
      setHandleDraft(next.handle ?? "");
      setAccountDialog(null);
      setMessage("Public handle updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Handle could not be updated.");
    } finally {
      setPendingAction(null);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    begin("password");
    try {
      await updateCurrentUserPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      if (isRecoveryMode) {
        await signOut();
        await router.replace("/login?passwordReset=1");
        return;
      }
      setAccountDialog(null);
      setMessage("Password updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password could not be updated.");
    } finally {
      setPendingAction(null);
    }
  }

  const handleChangeAllowed = canChangeHandle(profile?.handle_changed_at);
  const nextHandleChangeAt = getNextHandleChangeAt(profile?.handle_changed_at);

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return;
    begin("delete");
    try { await deleteCurrentUserAccount(); await router.replace("/"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Account could not be deleted."); setPendingAction(null); }
  }

  async function deleteStats() {
    if (statsConfirmation !== "DELETE STATS") return;
    begin("stats");
    try { await deleteCurrentUserStats(); setStatsConfirmation(""); setMessage("All saved stats have been deleted."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Stats could not be deleted."); } finally { setPendingAction(null); }
  }

  function updateNotifications(key: keyof NotificationSettings, enabled: boolean) {
    const next = { ...notificationSettings, [key]: enabled };
    const writeResult = writeNotificationSettings(next);

    if (!writeResult.ok) {
      setMessage("");
      setError("Notification preferences could not be saved on this device.");
      return;
    }

    setNotificationSettings(next);
    setMessage("Notification preferences saved.");
    setError("");
  }

  return (
    <AppShell sideAd={false}>
      {isRecoveryMode ? (
        <section className="mx-auto max-w-xl rounded-lg border border-paper/[0.08] bg-ink-950/45 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md border border-brass/25 bg-brass/10 p-2 text-brass"><KeyRound className="icon-prominent" /></div>
            <div>
              <p className="font-mono text-utility uppercase text-brass">Account recovery</p>
              <h1 className="mt-2 text-page font-semibold text-paper">Set a new password</h1>
              <p className="mt-3 text-body leading-6 text-paper/60">Choose a new password for this account. You will return to Login when it has been updated.</p>
            </div>
          </div>

          {(message || error) && <div role={error ? "alert" : "status"} className={`mt-5 rounded-md border px-4 py-3 font-mono text-body ${error ? "border-ember/25 bg-ember/10 text-ember" : "border-mint/25 bg-mint/10 text-mint"}`}>{error || message}</div>}

          {isAuthLoading ? (
            <p role="status" className="mt-6 font-mono text-body text-paper/55">Checking recovery link…</p>
          ) : user ? (
            <form onSubmit={savePassword} className="mt-6 grid gap-4">
              <label><span className="account-label">New password</span><input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="formaltype-themed-input mt-2 w-full px-3 py-3" /></label>
              <label><span className="account-label">Confirm password</span><input aria-label="Confirm password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="formaltype-themed-input mt-2 w-full px-3 py-3" /></label>
              <button disabled={!newPassword || !confirmPassword || pendingAction === "password"} className="account-primary-button justify-self-start">{pendingAction === "password" ? "Updating…" : "Update password"}</button>
            </form>
          ) : (
            <div className="mt-6 rounded-md border border-ember/25 bg-ember/10 px-4 py-4">
              <p role="alert" className="font-mono text-body text-ember">This recovery link is invalid or has expired.</p>
              <Link href="/login?mode=recovery" className="mt-3 inline-flex font-mono text-body text-brass hover:underline">Request a new link</Link>
            </div>
          )}
        </section>
      ) : (
      <ProfilePageLayout>
        {user && <div className="mt-6 space-y-5">
          {!accountDialog && (message || error) && <div role={error ? "alert" : "status"} className={`rounded-md border px-4 py-3 font-mono text-body ${error ? "border-ember/25 bg-ember/10 text-ember" : "border-mint/25 bg-mint/10 text-mint"}`}>{error || message}</div>}

          <AccountSection icon={<UserRound className="icon-prominent" />} title="Identity" description="Manage the public handle and sign-in details attached to this account.">
            <div className="account-setting-row">
              <div><span className="account-label">Public handle</span><span className="account-help">Profile URL and leaderboard identity. Changes are limited to once every 30 days.</span></div>
              <div className="flex flex-wrap items-center justify-end gap-3"><span className="font-mono text-body text-paper">{isProfileLoading ? "Loading…" : `@${profile?.handle ?? "not-set"}`}</span><button type="button" aria-label="Change public handle" onClick={() => openAccountDialog("handle")} disabled={!profile || !handleChangeAllowed} className="account-primary-button">{handleChangeAllowed ? "Change" : formatHandleAvailability(nextHandleChangeAt)}</button></div>
            </div>
            <div className="account-setting-row"><div><span className="account-label">Email</span><span className="account-help">Used to sign in and recover access.</span></div><span className="font-mono text-body text-paper/75">{user.email}</span></div>
          </AccountSection>

          <AccountSection icon={<KeyRound className="icon-prominent" />} title="Security" description="Use at least eight characters and avoid reusing another password.">
            <div className="account-setting-row"><div><span className="account-label">Password</span><span className="account-help">Open a private form only when you need to change it.</span></div><button type="button" onClick={() => openAccountDialog("password")} className="account-primary-button">Change password</button></div>
          </AccountSection>

          <AccountSection icon={<Bell className="icon-prominent" />} title="Notifications" description="Choose which activity appears in your Typing Station notification area.">
            <NotificationRow label="Achievements" description="Milestones, personal bests and streak updates." checked={notificationSettings.achievements} onChange={(value) => updateNotifications("achievements", value)} />
            <NotificationRow label="Friend requests" description="New requests and accepted connections." checked={notificationSettings.friendRequests} onChange={(value) => updateNotifications("friendRequests", value)} />
            <NotificationRow label="Weekly summary" description="A compact recap of practice, speed and accuracy." checked={notificationSettings.weeklySummary} onChange={(value) => updateNotifications("weeklySummary", value)} />
          </AccountSection>

          <section className="rounded-lg border border-ember/20 bg-ember/[0.035] p-5">
            <div className="flex items-center gap-3"><DatabaseZap className="icon-prominent text-ember" /><div className="flex flex-wrap items-baseline gap-x-3"><h2 className="font-mono text-section uppercase text-ember">Delete stats</h2><p className="text-body text-paper/45">Clears results, analytics and attempt details without deleting your account.</p></div></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label><span className="account-label">Type DELETE STATS to confirm</span><input aria-label="Delete stats confirmation" value={statsConfirmation} onChange={(e) => setStatsConfirmation(e.target.value)} className="formaltype-themed-input mt-2 px-3 py-2 font-mono" /></label><button type="button" onClick={deleteStats} disabled={statsConfirmation !== "DELETE STATS" || pendingAction === "stats"} className="rounded-md border border-ember/35 bg-ember/10 px-4 py-2.5 font-mono text-control uppercase text-ember transition hover:bg-ember/20 disabled:cursor-not-allowed disabled:opacity-35">{pendingAction === "stats" ? "Deleting…" : "Delete stats"}</button></div>
          </section>

          <section className="rounded-lg border border-ember/20 bg-ember/[0.045] p-5">
            <div className="flex items-center gap-3"><AlertTriangle className="icon-prominent text-ember" /><div className="flex flex-wrap items-baseline gap-x-3"><h2 className="font-mono text-section uppercase text-ember">Delete account</h2><p className="text-body text-paper/45">Permanently deletes your profile, friendships, saved results and authentication account. This cannot be undone.</p></div></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label><span className="account-label">Type DELETE to confirm</span><input aria-label="Delete confirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="formaltype-themed-input mt-2 px-3 py-2 font-mono" /></label><button type="button" onClick={deleteAccount} disabled={deleteConfirmation !== "DELETE" || pendingAction === "delete"} className="rounded-md border border-ember/35 bg-ember/10 px-4 py-2.5 font-mono text-control uppercase text-ember transition hover:bg-ember/20 disabled:cursor-not-allowed disabled:opacity-35">{pendingAction === "delete" ? "Deleting…" : "Delete permanently"}</button></div>
          </section>

          {accountDialog === "handle" && (
            <AccountDialog id="handle-dialog" eyebrow="Public identity" title="Change handle" description="Your old profile URL will stop working. The next change is available 30 days after saving." errorMessage={error} onClose={closeAccountDialog} isBusy={pendingAction === "handle"}>
              <form onSubmit={saveHandle} className="mt-5 grid gap-4">
                <label><span className="account-label">New handle</span><div className="formaltype-themed-input mt-2 flex items-center px-3"><span className="text-paper/35">@</span><input aria-label="New handle" value={handleDraft} onChange={(event) => setHandleDraft(event.target.value)} minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" required className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none" /></div></label>
                <DialogActions onCancel={closeAccountDialog} isBusy={pendingAction === "handle"} submitLabel={pendingAction === "handle" ? "Saving…" : "Save handle"} />
              </form>
            </AccountDialog>
          )}

          {accountDialog === "password" && (
            <AccountDialog id="password-dialog" eyebrow="Security" title="Change password" description="Enter the password you want to use. Nothing is generated or saved by Typing Station." errorMessage={error} onClose={closeAccountDialog} isBusy={pendingAction === "password"}>
              <form onSubmit={savePassword} autoComplete="new-password" className="mt-5 grid gap-4">
                <label><span className="account-label">New password</span><input ref={newPasswordInputRef} aria-label="New password" name="formaltype-new-password" type="password" autoComplete="new-password" data-1p-ignore="true" data-lpignore="true" data-form-type="other" spellCheck={false} minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="formaltype-themed-input mt-2 w-full px-3 py-3" /></label>
                <label><span className="account-label">Confirm password</span><input ref={confirmPasswordInputRef} aria-label="Confirm password" name="formaltype-confirm-password" type="password" autoComplete="new-password" data-1p-ignore="true" data-lpignore="true" data-form-type="other" spellCheck={false} minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="formaltype-themed-input mt-2 w-full px-3 py-3" /></label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={clearPasswordFields} className="rounded-md px-2 py-2 font-mono text-control text-paper/45 transition hover:text-paper">Clear fields</button>
                  <DialogActions onCancel={closeAccountDialog} isBusy={pendingAction === "password"} submitLabel={pendingAction === "password" ? "Updating…" : "Update password"} submitDisabled={!newPassword || !confirmPassword} />
                </div>
              </form>
            </AccountDialog>
          )}
        </div>}
      </ProfilePageLayout>
      )}
    </AppShell>
  );
}

function AccountDialog({
  id,
  eyebrow,
  title,
  description,
  errorMessage,
  onClose,
  isBusy,
  children
}: React.PropsWithChildren<{
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  errorMessage?: string;
  onClose: () => void;
  isBusy: boolean;
}>) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(isBusy);

  useEffect(() => {
    onCloseRef.current = onClose;
    isBusyRef.current = isBusy;
  }, [isBusy, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !isBusyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/85 px-4 py-4 backdrop-blur">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="w-full max-w-lg rounded-lg border border-brass/25 bg-ink-900 p-5 shadow-glow md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-utility uppercase text-brass">{eyebrow}</p>
            <h2 id={`${id}-title`} className="mt-1 text-page font-semibold text-paper">{title}</h2>
            <p id={`${id}-description`} className="mt-2 text-body leading-6 text-paper/50">{description}</p>
          </div>
          <IconButton ref={closeButtonRef} onClick={onClose} disabled={isBusy} label={`Close ${title}`}><X className="icon-control" strokeWidth={1.75} /></IconButton>
        </div>
        {errorMessage && <div role="alert" className="mt-4 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-body text-ember">{errorMessage}</div>}
        {children}
      </section>
    </div>
  );
}

function DialogActions({
  onCancel,
  isBusy,
  submitLabel,
  submitDisabled = false
}: {
  onCancel: () => void;
  isBusy: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onCancel} disabled={isBusy} className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-control text-paper/65 transition hover:border-paper/20 hover:text-paper disabled:opacity-50">Cancel</button>
      <button type="submit" disabled={isBusy || submitDisabled} className="account-primary-button disabled:cursor-not-allowed">{submitLabel}</button>
    </div>
  );
}

function formatHandleAvailability(nextChangeAt: Date | null) {
  if (!nextChangeAt) return "Change";
  return `Available ${nextChangeAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function AccountSection({ icon, title, description, children }: React.PropsWithChildren<{ icon: React.ReactNode; title: string; description: string }>) {
  return <section className="rounded-lg border border-paper/[0.08] bg-ink-950/45 p-5"><div className="flex items-center gap-3 text-brass">{icon}<div className="flex flex-wrap items-baseline gap-x-3"><h2 className="font-mono text-section uppercase">{title}</h2><p className="text-body text-paper/45">{description}</p></div></div><div className="mt-5 divide-y divide-paper/10">{children}</div></section>;
}

function NotificationRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="account-setting-row cursor-pointer"><span><span className="account-label">{label}</span><span className="account-help">{description}</span></span><span className={`relative h-6 w-11 rounded-full border transition ${checked ? "border-brass/50 bg-brass/30" : "border-paper/15 bg-paper/5"}`}><input type="checkbox" className="sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} /></span></label>;
}
