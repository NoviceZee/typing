"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AlertTriangle, Bell, DatabaseZap, KeyRound, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfilePageHeader } from "@/components/ProfilePageHeader";
import { useAuth } from "@/components/AuthProvider";
import { SupabaseProfile, getSupabaseProfile, updateSupabaseProfileDisplayName } from "@/lib/profileStorage";
import { deleteCurrentUserAccount, deleteCurrentUserStats, updateCurrentUserPassword } from "@/lib/accountStorage";
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings, readNotificationSettings, writeNotificationSettings } from "@/lib/notificationSettings";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [statsConfirmation, setStatsConfirmation] = useState("");
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<"name" | "password" | "stats" | "delete" | null>(null);

  useEffect(() => { if (!isAuthLoading && !user) void router.push("/login?redirectTo=/profile/account"); }, [isAuthLoading, router, user]);
  useEffect(() => {
    setNotificationSettings(readNotificationSettings());
  }, []);
  useEffect(() => {
    let mounted = true;
    if (!user) { setProfile(null); return; }
    getSupabaseProfile(user.id).then((next) => { if (!mounted) return; setProfile(next); setDisplayName(next?.display_name ?? ""); }).catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : "Profile could not be loaded."); });
    return () => { mounted = false; };
  }, [user]);

  function begin(action: "name" | "password" | "stats" | "delete") { setMessage(""); setError(""); setPendingAction(action); }

  async function saveName(event: FormEvent) {
    event.preventDefault(); if (!user) return; begin("name");
    try { const next = await updateSupabaseProfileDisplayName(user.id, displayName); setProfile(next); setDisplayName(next.display_name); setMessage("Display name updated."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Name could not be updated."); } finally { setPendingAction(null); }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    begin("password");
    try { await updateCurrentUserPassword(newPassword); setNewPassword(""); setConfirmPassword(""); setMessage("Password updated."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Password could not be updated."); } finally { setPendingAction(null); }
  }

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
    setNotificationSettings(next); writeNotificationSettings(next); setMessage("Notification preferences saved."); setError("");
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-6xl">
        <ProfilePageHeader />
        {user && <div className="mt-6 space-y-5">
          {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-md border px-4 py-3 font-mono text-sm ${error ? "border-ember/25 bg-ember/10 text-ember" : "border-mint/25 bg-mint/10 text-mint"}`}>{error || message}</div>}

          <AccountSection icon={<UserRound className="h-5 w-5" />} title="Identity" description="Manage the private name and sign-in details attached to this account.">
            <form onSubmit={saveName} className="account-setting-row">
              <label className="min-w-0"><span className="account-label">Display name</span><span className="account-help">Used inside your account. Your public identity remains @{profile?.handle ?? "handle"}.</span></label>
              <div className="flex gap-2"><input aria-label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="formaltype-themed-input min-w-0 px-3 py-2 font-mono text-sm" /><button disabled={pendingAction === "name"} className="account-primary-button">{pendingAction === "name" ? "Saving…" : "Save name"}</button></div>
            </form>
            <div className="account-setting-row"><div><span className="account-label">Handle</span><span className="account-help">Permanent public URL and leaderboard identity.</span></div><span className="font-mono text-sm text-paper">@{profile?.handle ?? "not-set"}</span></div>
            <div className="account-setting-row"><div><span className="account-label">Email</span><span className="account-help">Used to sign in and recover access.</span></div><span className="font-mono text-sm text-paper/75">{user.email}</span></div>
          </AccountSection>

          <AccountSection icon={<KeyRound className="h-5 w-5" />} title="Security" description="Use at least eight characters and avoid reusing another password.">
            <form onSubmit={savePassword} className="grid gap-3 sm:grid-cols-2">
              <label><span className="account-label">New password</span><input aria-label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="formaltype-themed-input mt-2 w-full px-3 py-2" /></label>
              <label><span className="account-label">Confirm password</span><input aria-label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="formaltype-themed-input mt-2 w-full px-3 py-2" /></label>
              <button disabled={!newPassword || pendingAction === "password"} className="account-primary-button sm:col-start-2 sm:justify-self-end">{pendingAction === "password" ? "Updating…" : "Update password"}</button>
            </form>
          </AccountSection>

          <AccountSection icon={<Bell className="h-5 w-5" />} title="Notifications" description="Choose which activity appears in your FormalType notification area.">
            <NotificationRow label="Achievements" description="Milestones, personal bests and streak updates." checked={notificationSettings.achievements} onChange={(value) => updateNotifications("achievements", value)} />
            <NotificationRow label="Friend requests" description="New requests and accepted connections." checked={notificationSettings.friendRequests} onChange={(value) => updateNotifications("friendRequests", value)} />
            <NotificationRow label="Weekly summary" description="A compact recap of practice, speed and accuracy." checked={notificationSettings.weeklySummary} onChange={(value) => updateNotifications("weeklySummary", value)} />
          </AccountSection>

          <section className="rounded-xl border border-ember/20 bg-ember/[0.035] p-5">
            <div className="flex items-center gap-3"><DatabaseZap className="h-5 w-5 shrink-0 text-ember" /><div className="flex flex-wrap items-baseline gap-x-3"><h2 className="font-mono text-sm uppercase text-ember">Delete stats</h2><p className="text-sm text-paper/45">Clears results, analytics and attempt details without deleting your account.</p></div></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label><span className="account-label">Type DELETE STATS to confirm</span><input aria-label="Delete stats confirmation" value={statsConfirmation} onChange={(e) => setStatsConfirmation(e.target.value)} className="formaltype-themed-input mt-2 px-3 py-2 font-mono" /></label><button type="button" onClick={deleteStats} disabled={statsConfirmation !== "DELETE STATS" || pendingAction === "stats"} className="rounded-md border border-ember/35 bg-ember/10 px-4 py-2.5 font-mono text-xs uppercase text-ember transition hover:bg-ember/20 disabled:cursor-not-allowed disabled:opacity-35">{pendingAction === "stats" ? "Deleting…" : "Delete stats"}</button></div>
          </section>

          <section className="rounded-xl border border-ember/20 bg-ember/[0.045] p-5">
            <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-ember" /><div className="flex flex-wrap items-baseline gap-x-3"><h2 className="font-mono text-sm uppercase text-ember">Delete account</h2><p className="text-sm text-paper/45">Permanently deletes your profile, friendships, saved results and authentication account. This cannot be undone.</p></div></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label><span className="account-label">Type DELETE to confirm</span><input aria-label="Delete confirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="formaltype-themed-input mt-2 px-3 py-2 font-mono" /></label><button type="button" onClick={deleteAccount} disabled={deleteConfirmation !== "DELETE" || pendingAction === "delete"} className="rounded-md border border-ember/35 bg-ember/10 px-4 py-2.5 font-mono text-xs uppercase text-ember transition hover:bg-ember/20 disabled:cursor-not-allowed disabled:opacity-35">{pendingAction === "delete" ? "Deleting…" : "Delete permanently"}</button></div>
          </section>
        </div>}
      </section>
    </AppShell>
  );
}

function AccountSection({ icon, title, description, children }: React.PropsWithChildren<{ icon: React.ReactNode; title: string; description: string }>) {
  return <section className="rounded-xl border border-paper/10 bg-ink-950/75 p-5 shadow-glow"><div className="flex items-center gap-3 text-brass">{icon}<div className="flex flex-wrap items-baseline gap-x-3"><h2 className="font-mono text-sm uppercase">{title}</h2><p className="text-sm text-paper/45">{description}</p></div></div><div className="mt-5 divide-y divide-paper/10">{children}</div></section>;
}

function NotificationRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="account-setting-row cursor-pointer"><span><span className="account-label">{label}</span><span className="account-help">{description}</span></span><span className={`relative h-6 w-11 rounded-full border transition ${checked ? "border-brass/50 bg-brass/30" : "border-paper/15 bg-paper/5"}`}><input type="checkbox" className="sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} /></span></label>;
}
