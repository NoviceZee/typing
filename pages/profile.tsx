"use client";

import React, { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { Activity, Award, Camera, Clock, Copy, ExternalLink, Flame, Lock, UserCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfileSectionNav } from "@/components/ProfileSectionNav";
import { ProfilePageHeader } from "@/components/ProfilePageHeader";
import { ProfilePageLayout } from "@/components/ProfilePageLayout";
import { useAuth } from "@/components/AuthProvider";
import { buildProgressAnalytics } from "@/lib/analytics";
import {
  ANALYTICS_DOMAIN_OPTIONS,
  AnalyticsDomain,
  getCategoryAnalyticsDomain,
  getDomainEmptyState,
  getResultAnalyticsDomain
} from "@/lib/analyticsDomain";
import {
  SupabaseProfile,
  getSupabaseAvatarPublicUrl,
  getSupabaseProfile,
  removeSupabaseProfileAvatar,
  uploadSupabaseProfileAvatar,
  updateSupabaseProfileIdentity
} from "@/lib/profileStorage";
import {
  SupabaseAnalyticsTypingResultRow,
  getSupabaseAnalyticsTypingResults
} from "@/lib/typingResultStorage";
import {
  aggregateTypingStatistics,
  buildTypingReplayEvents,
  getFullKeyboardLayout,
  readTypingAttemptDetails
} from "@/lib/typingStatistics";
import { getSupabaseTypingAttemptDetails, syncLocalTypingAttemptDetails } from "@/lib/typingAttemptStorage";
import type { KeyStatistic, TypingAttemptDetail, TypingReplayEvent, TypingStatistics } from "@/lib/typingStatistics";
import { buildAttemptConsistencySummary, getConsistencyScorePath } from "@/lib/practiceConsistency";
import { DEFAULT_PROFILE_DISPLAY_SETTINGS, ProfileDisplaySettings, readProfileDisplaySettings, writeProfileDisplaySettings } from "@/lib/profileDisplaySettings";
import { getSiteUrl } from "@/lib/siteMetadata";

type TrendRange = "30" | "90" | "all";
type HeatmapMode = "accuracy" | "speed" | "mistakes";

function mergeTypingAttemptDetails(...groups: TypingAttemptDetail[][]): TypingAttemptDetail[] {
  return Array.from(new Map(groups.flat().map((detail) => [detail.id, detail])).values())
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
    .slice(0, 50);
}

const TREND_RANGES: Array<{ id: TrendRange; label: string }> = [
  { id: "30", label: "Last 30" },
  { id: "90", label: "Last 90" },
  { id: "all", label: "All-time" }
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [results, setResults] = useState<SupabaseAnalyticsTypingResultRow[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsMessage, setResultsMessage] = useState("");
  const [identityMessage, setIdentityMessage] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [bio, setBio] = useState("");
  const [avatarStyle, setAvatarStyle] = useState("amber");
  const [isPublicProfileEnabled, setIsPublicProfileEnabled] = useState(true);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [trendRange, setTrendRange] = useState<TrendRange>("30");
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("accuracy");
  const [analyticsDomain, setAnalyticsDomain] = useState<AnalyticsDomain>("english");
  const [displaySettings, setDisplaySettings] = useState<ProfileDisplaySettings>(DEFAULT_PROFILE_DISPLAY_SETTINGS);
  const [displaySettingsError, setDisplaySettingsError] = useState("");
  const domainResults = useMemo(
    () => results.filter((result) => getResultAnalyticsDomain(result) === analyticsDomain),
    [analyticsDomain, results]
  );
  const analytics = useMemo(() => buildProgressAnalytics(results, { domain: analyticsDomain }), [analyticsDomain, results]);
  const trendResults = useMemo(() => getTrendResults(domainResults, trendRange), [domainResults, trendRange]);
  const [typingAttemptDetails, setTypingAttemptDetails] = useState<TypingAttemptDetail[]>([]);
  const typingStatistics = useMemo(
    () => aggregateTypingStatistics(typingAttemptDetails, { domain: analyticsDomain }),
    [analyticsDomain, typingAttemptDetails]
  );
  const consistency = useMemo(
    () => buildAttemptConsistencySummary(typingAttemptDetails, (category) => getCategoryAnalyticsDomain(category) === analyticsDomain),
    [analyticsDomain, typingAttemptDetails]
  );
  const emptyState = getDomainEmptyState(analyticsDomain);

  useEffect(() => {
    const nextDisplaySettings = readProfileDisplaySettings();
    setDisplaySettings(nextDisplaySettings);
    setTrendRange(nextDisplaySettings.defaultTrendRange);
  }, []);

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.push("/login?redirectTo=/profile");
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setProfile(null);
      setResults([]);
      setResultsMessage("");
      setIsLoadingResults(false);
      setTypingAttemptDetails([]);
      return;
    }

    setIsLoadingResults(true);
    setResultsMessage("");
    const localAttemptDetails = readTypingAttemptDetails(user.id);
    Promise.all([
      getSupabaseAnalyticsTypingResults(user.id),
      getSupabaseProfile(user.id),
      getSupabaseTypingAttemptDetails(user.id).catch(() => localAttemptDetails)
    ])
      .then(([typingResults, nextProfile, cloudAttemptDetails]) => {
        if (!isMounted) return;
        setResults(typingResults);
        setProfile(nextProfile);
        setBio(nextProfile?.bio ?? "");
        setAvatarStyle(nextProfile?.avatar_style ?? "amber");
        setIsPublicProfileEnabled(nextProfile?.public_profile_enabled ?? true);
        setTypingAttemptDetails(mergeTypingAttemptDetails(cloudAttemptDetails, localAttemptDetails));
        if (localAttemptDetails.length > 0) {
          void syncLocalTypingAttemptDetails(localAttemptDetails).catch(() => undefined);
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        setResultsMessage(error instanceof Error ? error.message : "Progress analytics could not be loaded.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingResults(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function handleCopyPublicProfileUrl() {
    if (!profile?.handle || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(getPublicProfileUrl(profile.handle));
    setCopyMessage("Copied");
  }

  function handleDisplaySettingsChange(next: ProfileDisplaySettings) {
    const writeResult = writeProfileDisplaySettings(next);

    if (!writeResult.ok) {
      setDisplaySettingsError("Display preferences could not be saved on this device.");
      return;
    }

    setDisplaySettings(next);
    setDisplaySettingsError("");
    if (next.defaultTrendRange !== displaySettings.defaultTrendRange) {
      setTrendRange(next.defaultTrendRange);
    }
  }

  async function handleSaveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setIsSavingIdentity(true);
    setIdentityMessage("");
    setIdentityError("");

    try {
      const nextProfile = await updateSupabaseProfileIdentity(user.id, {
        bio,
        avatar_style: avatarStyle,
        public_profile_enabled: isPublicProfileEnabled
      });
      setProfile(nextProfile);
      setBio(nextProfile.bio ?? "");
      setAvatarStyle(nextProfile.avatar_style ?? "amber");
      setIsPublicProfileEnabled(nextProfile.public_profile_enabled);
      setIdentityMessage("Identity settings saved.");
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "Identity settings could not be saved.");
    } finally {
      setIsSavingIdentity(false);
    }
  }

  async function handleAvatarFileChange(file: File | null) {
    if (!user || !file) {
      return;
    }

    setAvatarMessage("");
    setAvatarError("");

    const previewUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;

    if (previewUrl) {
      setAvatarPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(currentPreviewUrl);
        }

        return previewUrl;
      });
    }
    setIsAvatarUploading(true);

    try {
      const preparedFile = await prepareAvatarUploadFile(file);
      const nextProfile = await uploadSupabaseProfileAvatar(user.id, preparedFile);
      setProfile(nextProfile);
      setAvatarMessage("Avatar uploaded.");
      setAvatarPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(currentPreviewUrl);
        }

        return null;
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Avatar could not be uploaded.");
    } finally {
      setIsAvatarUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!user) {
      return;
    }

    setAvatarMessage("");
    setAvatarError("");
    setIsAvatarUploading(true);

    try {
      const nextProfile = await removeSupabaseProfileAvatar(user.id, profile?.avatar_path);
      setProfile(nextProfile);
      setAvatarPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(currentPreviewUrl);
        }

        return null;
      });
      setAvatarMessage("Avatar removed.");
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Avatar could not be removed.");
    } finally {
      setIsAvatarUploading(false);
    }
  }

  return (
    <AppShell sideAd={false}>
      <ProfilePageLayout>

        {!user && !isAuthLoading && (
          <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
            <p className="font-mono text-sm text-paper/55">
              <Link href="/login?redirectTo=/profile" className="text-brass hover:text-brass/80">
                Log in
              </Link>{" "}
              to view your profile.
            </p>
          </section>
        )}

        {user && (
          <div className="mt-6 space-y-6">
            <ProfileIdentityCard
              profile={profile}
              analytics={analytics}
              copyMessage={copyMessage}
              onCopyPublicProfileUrl={handleCopyPublicProfileUrl}
              bio={bio}
              avatarStyle={avatarStyle}
              avatarUrl={avatarPreviewUrl ?? getSupabaseAvatarPublicUrl(profile?.avatar_path)}
              avatarPath={profile?.avatar_path ?? null}
              isPublicProfileEnabled={isPublicProfileEnabled}
              identityMessage={identityMessage}
              identityError={identityError}
              avatarMessage={avatarMessage}
              avatarError={avatarError}
              isSavingIdentity={isSavingIdentity}
              isAvatarUploading={isAvatarUploading}
              onBioChange={setBio}
              onAvatarStyleChange={setAvatarStyle}
              onPublicProfileEnabledChange={setIsPublicProfileEnabled}
              onAvatarFileChange={handleAvatarFileChange}
              onRemoveAvatar={handleRemoveAvatar}
              onSaveIdentity={handleSaveIdentity}
            />

            {resultsMessage && (
              <div role="alert" className="rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
                {resultsMessage}
              </div>
            )}

            <section className="flex flex-col gap-3 rounded-lg border border-paper/10 bg-ink-950/55 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <AnalyticsDomainSelector value={analyticsDomain} onChange={setAnalyticsDomain} />
              <ProfileViewPreferences value={displaySettings} onChange={handleDisplaySettingsChange} />
            </section>

            {displaySettingsError && (
              <p role="alert" className="font-mono text-sm text-ember">
                {displaySettingsError}
              </p>
            )}

            {isLoadingResults && (
              <div role="status" aria-live="polite" className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-5 font-mono text-sm text-paper/45">
                Loading profile...
              </div>
            )}

            {!isLoadingResults && domainResults.length === 0 && !resultsMessage && (
              <>
                <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
                  <p className="font-mono text-sm text-paper/55">
                    {emptyState.title}{" "}
                    <Link href={analyticsDomain === "english" ? "/practice" : "/training"} className="text-brass hover:text-brass/80">
                      {analyticsDomain === "english" ? "Start a practice session" : "Open Training"}
                    </Link>{" "}
                    {emptyState.action}
                  </p>
                </section>
                {analyticsDomain === "english" && typingStatistics.keys.length > 0 && (
                  <TypingWeaknessesSection
                    statistics={typingStatistics}
                    heatmapMode={heatmapMode}
                    onHeatmapModeChange={setHeatmapMode}
                  />
                )}
                <ChallengesSection analytics={analytics} />
                <AchievementsSection analytics={analytics} />
              </>
            )}

            {domainResults.length > 0 && (
              <>
                <ProgressSummary analytics={analytics} displaySettings={displaySettings} />
                {analyticsDomain === "english" && (
                  <TypingWeaknessesSection
                    statistics={typingStatistics}
                    heatmapMode={heatmapMode}
                    onHeatmapModeChange={setHeatmapMode}
                  />
                )}
                {analyticsDomain === "chinese" && <ChineseMistakesSection statistics={typingStatistics} />}
                <Trends
                  range={trendRange}
                  results={trendResults}
                  onRangeChange={setTrendRange}
                />
                <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                  <ConsistencySection summary={consistency} />
                  <CategoryBreakdown analytics={analytics} />
                </section>
                <ActivitySection analytics={analytics} />
                <ChallengesSection analytics={analytics} />
                <AchievementsSection analytics={analytics} />
                <MyResults results={domainResults} domain={analyticsDomain} />
              </>
            )}
          </div>
        )}
      </ProfilePageLayout>
    </AppShell>
  );
}

function AnalyticsDomainSelector({
  value,
  onChange
}: {
  value: AnalyticsDomain;
  onChange: (domain: AnalyticsDomain) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Profile stats domain">
      {ANALYTICS_DOMAIN_OPTIONS.map((option) => {
        const isSelected = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.id)}
            className={`rounded-md border px-3 py-2 font-mono text-xs transition ${
              isSelected
                ? "border-brass/60 bg-brass/15 text-brass"
                : "border-paper/10 bg-ink-950 text-paper/55 hover:border-paper/25 hover:text-paper"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ProfileViewPreferences({ value, onChange }: { value: ProfileDisplaySettings; onChange: (value: ProfileDisplaySettings) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div className="lg:hidden"><p className="font-mono text-xs uppercase text-paper/55">View preferences</p><p className="mt-1 text-xs text-paper/35">Saved on this device</p></div>
      <div className="flex flex-wrap gap-4 font-mono text-xs">
        <PreferenceButtons label="Speed unit" value={value.speedUnit} options={[{value:"wpm",label:"WPM"},{value:"cpm",label:"CPM"}]} onChange={(speedUnit) => onChange({...value,speedUnit: speedUnit as ProfileDisplaySettings["speedUnit"]})} />
        <PreferenceButtons label="Decimals" value={value.showDecimals ? "on" : "off"} options={[{value:"on",label:"On"},{value:"off",label:"Off"}]} onChange={(next) => onChange({...value,showDecimals:next === "on"})} />
        <PreferenceButtons label="Default range" value={value.defaultTrendRange} options={[{value:"30",label:"30"},{value:"90",label:"90"},{value:"all",label:"All"}]} onChange={(defaultTrendRange) => onChange({...value,defaultTrendRange: defaultTrendRange as TrendRange})} />
      </div>
    </div>;
}

function PreferenceButtons({ label, value, options, onChange }: { label: string; value: string; options: {value:string;label:string}[]; onChange:(value:string)=>void }) {
  return <div role="group" aria-label={label} className="flex items-center gap-1"><span className="mr-1 text-paper/30">{label}</span>{options.map((option)=><button key={option.value} type="button" aria-pressed={value===option.value} onClick={()=>onChange(option.value)} className={`rounded px-2 py-1 transition ${value===option.value?"bg-brass/15 text-brass":"text-paper/45 hover:bg-paper/5 hover:text-paper"}`}>{option.label}</button>)}</div>;
}

function ProfileIdentityCard({
  profile,
  analytics,
  copyMessage,
  onCopyPublicProfileUrl,
  bio,
  avatarStyle,
  avatarUrl,
  avatarPath,
  isPublicProfileEnabled,
  identityMessage,
  identityError,
  avatarMessage,
  avatarError,
  isSavingIdentity,
  isAvatarUploading,
  onBioChange,
  onAvatarStyleChange,
  onPublicProfileEnabledChange,
  onAvatarFileChange,
  onRemoveAvatar,
  onSaveIdentity
}: {
  profile: SupabaseProfile | null;
  analytics: ReturnType<typeof buildProgressAnalytics>;
  copyMessage: string;
  onCopyPublicProfileUrl: () => void;
  bio: string;
  avatarStyle: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  isPublicProfileEnabled: boolean;
  identityMessage: string;
  identityError: string;
  avatarMessage: string;
  avatarError: string;
  isSavingIdentity: boolean;
  isAvatarUploading: boolean;
  onBioChange: (value: string) => void;
  onAvatarStyleChange: (value: string) => void;
  onPublicProfileEnabledChange: (value: boolean) => void;
  onAvatarFileChange: (file: File | null) => void;
  onRemoveAvatar: () => void;
  onSaveIdentity: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const handle = profile?.handle;
  const publicProfileUrl = handle ? getPublicProfileUrl(handle) : "Set a handle to publish your profile.";

  return (
    <section id="identity-settings" className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 gap-4">
          <div className="space-y-2">
            <ProfileAvatar
              avatarUrl={avatarUrl}
              avatarStyle={avatarStyle}
              isUploading={isAvatarUploading}
              label={handle ? `@${handle}` : "Profile"}
              onAvatarFileChange={onAvatarFileChange}
            />
            {avatarPath && (
              <button
                type="button"
                aria-label="Remove avatar"
                onClick={onRemoveAvatar}
                disabled={isAvatarUploading}
                className="block w-16 text-center font-mono text-secondary uppercase text-paper/35 transition hover:text-ember disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase text-brass">Profile Identity</p>
            <h2 className="mt-1 break-words font-mono text-page font-semibold text-paper">
              {handle ? `@${handle}` : "Handle not set"}
            </h2>
            <p className="mt-2 font-mono text-xs uppercase text-paper/35">{formatJoinedDate(profile?.created_at)}</p>
            {bio ? <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/60">{bio}</p> : null}
            <p className="mt-3 break-all font-mono text-xs text-paper/45">{publicProfileUrl}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCopyPublicProfileUrl}
                disabled={!handle}
                aria-label="Copy public profile URL"
                className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/65 transition hover:border-brass/40 hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                <span aria-live="polite">{copyMessage || "Copy URL"}</span>
              </button>
              {handle && (
                <Link
                  href={`/u/${handle}`}
                  className="inline-flex items-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-3 py-2 font-mono text-xs text-brass transition hover:border-brass/60 hover:bg-brass/15"
                >
                  <ExternalLink className="h-4 w-4" />
                  View public profile
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-paper/10 bg-ink-900/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-secondary uppercase text-paper/35">Level</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-paper">{analytics.progression.currentLevel}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-secondary uppercase text-paper/35">Total XP</p>
              <p className="mt-2 font-mono text-lg text-brass">{analytics.progression.totalXp}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/[0.06]">
            <div className="h-full rounded-full bg-brass" style={{ width: `${analytics.progression.progressPercent}%` }} />
          </div>
          <p className="mt-2 text-right font-mono text-secondary uppercase text-paper/35">
            {analytics.progression.xpToNextLevel} XP to next
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <IdentityStat label="Total tests" value={analytics.summary.totalTests} />
        <IdentityStat label="Best WPM" value={formatNumber(analytics.summary.bestWpm)} />
        <IdentityStat label="Best accuracy" value={`${formatNumber(analytics.summary.bestAccuracy)}%`} />
        <IdentityStat label="Current streak" value={`${analytics.activity.currentStreakDays} days`} />
      </div>

      <details className="mt-5 rounded-md border border-paper/10 bg-ink-900/35">
        <summary className="cursor-pointer px-4 py-3 font-mono text-xs uppercase text-paper/55 transition hover:text-paper">Edit identity and visibility</summary>
      <form onSubmit={onSaveIdentity} className="grid gap-4 border-t border-paper/10 p-4 lg:grid-cols-[minmax(0,1fr)_14rem_12rem]">
        <label className="block">
          <span className="font-mono text-xs uppercase text-paper/45">Bio</span>
          <textarea
            value={bio}
            onChange={(event) => onBioChange(event.target.value)}
            maxLength={180}
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-paper/10 bg-ink-900 px-3 py-2 text-sm leading-6 text-paper outline-none transition placeholder:text-paper/30 focus:border-brass"
            placeholder="A short public note for your Typing Station profile."
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase text-paper/45">Fallback avatar</span>
          <select
            value={avatarStyle}
            onChange={(event) => onAvatarStyleChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-sm text-paper outline-none transition focus:border-brass"
          >
            <option value="amber">amber</option>
            <option value="slate">slate</option>
            <option value="ember">ember</option>
          </select>
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/65">
            <input
              type="checkbox"
              checked={isPublicProfileEnabled}
              onChange={(event) => onPublicProfileEnabledChange(event.target.checked)}
              className="accent-brass"
            />
            Public profile visible
          </label>
          <button
            type="submit"
            disabled={isSavingIdentity}
            className="w-full rounded-md border border-brass/30 bg-brass/10 px-3 py-2 font-mono text-xs uppercase text-brass transition hover:border-brass/50 hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSavingIdentity ? "Saving..." : "Save identity"}
          </button>
        </div>
      </form>
      {(avatarMessage || avatarError || isAvatarUploading) && (
        <p role={avatarError ? "alert" : "status"} aria-live={avatarError ? "assertive" : "polite"} className={`mt-4 font-mono text-sm ${avatarError ? "text-ember" : "text-brass"}`}>
          {avatarError || (isAvatarUploading ? "Updating avatar..." : avatarMessage)}
        </p>
      )}

      {identityMessage && (
        <div role="status" aria-live="polite" className="mt-4 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
          {identityMessage}
        </div>
      )}
      {identityError && (
        <div role="alert" className="mt-4 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
          {identityError}
        </div>
      )}
      </details>
    </section>
  );
}

function ProfileAvatar({
  avatarUrl,
  avatarStyle,
  isUploading,
  label,
  onAvatarFileChange
}: {
  avatarUrl: string | null;
  avatarStyle: string;
  isUploading: boolean;
  label: string;
  onAvatarFileChange: (file: File | null) => void;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  return (
    <label className="group relative block h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full border border-brass/25 bg-ink-900">
      {avatarUrl && !hasImageError ? (
        <Image
          src={avatarUrl}
          alt={`${label} avatar`}
          width={64}
          height={64}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className={`flex h-full w-full items-center justify-center ${getAvatarStyleClass(avatarStyle)}`}>
          <UserCircle className="h-9 w-9" />
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-ink-950/70 opacity-0 transition group-hover:opacity-100">
        <Camera className="h-4 w-4 text-brass" />
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        aria-label="Change avatar"
        disabled={isUploading}
        className="sr-only"
        onChange={(event) => {
          onAvatarFileChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function IdentityStat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-md border border-paper/10 bg-ink-900/60 px-4 py-3">
      <p className="font-mono text-secondary uppercase text-paper/40">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-paper">{value}</p>
    </article>
  );
}

function ChallengesSection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ChallengeGroupSection group={analytics.challenges.daily} />
      <ChallengeGroupSection group={analytics.challenges.weekly} />
    </section>
  );
}

function ChallengeGroupSection({ group }: { group: ReturnType<typeof buildProgressAnalytics>["challenges"]["daily"] }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-section uppercase text-brass">{group.title}</h2>
      <div className="mt-4 space-y-3">
        {group.items.map((item) => (
          <article key={item.id} className="rounded-md border border-paper/10 bg-ink-900/70 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-xs uppercase text-paper">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-paper/45">{item.description}</p>
              </div>
              <span className={`font-mono text-xs uppercase ${item.isComplete ? "text-brass" : "text-paper/35"}`}>
                {item.isComplete ? "Done" : "Open"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper/[0.06]">
                <div
                  className="h-full rounded-full bg-brass/80"
                  style={{ width: `${Math.min(100, Math.round((item.progress / item.target) * 100))}%` }}
                />
              </div>
              <p className="min-w-20 text-right font-mono text-xs text-paper/55">
                {formatChallengeProgress(item.progress, item.unit)} / {formatChallengeProgress(item.target, item.unit)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AchievementsSection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-section uppercase text-brass">Achievements</h2>
          <p className="mt-1 font-mono text-secondary uppercase text-paper/35">
            {analytics.achievements.unlockedCount} / {analytics.achievements.totalCount} unlocked
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-brass/20 bg-brass/10 px-4 py-3">
          <Flame className="h-4 w-4 text-brass" />
          <div>
            <p className="font-mono text-secondary uppercase text-paper/40">Current streak</p>
            <p className="font-mono text-xl text-paper">{analytics.activity.currentStreakDays} days</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {analytics.achievements.items.map((achievement) => (
          <article
            key={achievement.id}
            className={`rounded-md border px-4 py-4 transition ${
              achievement.isUnlocked
                ? "border-brass/30 bg-brass/10"
                : "border-paper/10 bg-ink-900/70 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-sm uppercase text-paper">{achievement.title}</h3>
                <p className="mt-2 text-sm leading-6 text-paper/50">{achievement.description}</p>
              </div>
              <span
                className={`rounded-full border p-2 ${
                  achievement.isUnlocked
                    ? "border-brass/35 bg-brass/15 text-brass"
                    : "border-paper/10 bg-paper/[0.03] text-paper/30"
                }`}
                aria-hidden="true"
              >
                {achievement.isUnlocked ? <Award className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
            </div>
            <p
              className={`mt-4 font-mono text-secondary uppercase ${
                achievement.isUnlocked ? "text-brass" : "text-paper/35"
              }`}
            >
              {achievement.isUnlocked ? "Unlocked" : "Locked"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatChallengeProgress(value: number, unit: string) {
  return unit === "%" ? `${formatNumber(value)}%` : `${value}`;
}

function MyResults({ results, domain }: { results: SupabaseAnalyticsTypingResultRow[]; domain: AnalyticsDomain }) {
  const recentResults = [...results]
    .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
    .slice(0, 10);
  const title = domain === "chinese" ? "My Chinese Results" : domain === "code" ? "My Code Results" : "My Results";

  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-section uppercase text-brass">{title}</h2>
        <p className="mt-1 font-mono text-secondary uppercase text-paper/35">Recent attempts</p>
      </div>
      <div className="grid grid-cols-[9rem_minmax(0,1fr)_7rem_6rem_7rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-md:hidden md:px-5">
        <span>Date</span>
        <span>Passage</span>
        <span>Duration</span>
        <span>WPM</span>
        <span>Accuracy</span>
      </div>
      {recentResults.map((result) => (
        <article
          key={result.id}
          className="grid gap-3 border-b border-paper/10 px-4 py-4 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_7rem_6rem_7rem] md:items-center md:px-5"
        >
          <ResultMetric label="Date" value={formatDate(result.created_at)} />
          <div>
            <div className="font-mono text-secondary uppercase text-paper/35 md:hidden">Passage</div>
            <div className="text-sm font-semibold text-paper">{result.passage_title}</div>
            {result.passage_category && (
              <div className="mt-1 font-mono text-secondary uppercase text-paper/35">{result.passage_category}</div>
            )}
          </div>
          <ResultMetric label="Duration" value={formatDuration(result.duration_seconds)} />
          <ResultMetric label="WPM" value={formatNumber(result.wpm)} strong />
          <ResultMetric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
        </article>
      ))}
    </section>
  );
}

function ChineseMistakesSection({ statistics }: { statistics: TypingStatistics }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div>
        <h2 className="font-mono text-section uppercase text-brass">Chinese Mistakes</h2>
        <p className="mt-1 font-mono text-secondary uppercase text-paper/35">
          Chinese-only repeated mistake patterns
        </p>
      </div>
      <div className="mt-4">
        <CommonMistakesPanel mistakes={statistics.commonMistakes} />
      </div>
    </section>
  );
}

function ProgressSummary({ analytics, displaySettings }: { analytics: ReturnType<typeof buildProgressAnalytics>; displaySettings: ProfileDisplaySettings }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-section uppercase text-brass">Summary Stats</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total practice time" value={formatPracticeTime(analytics.summary.totalPracticeSeconds)} icon={<Clock className="h-4 w-4" />} />
        <SummaryCard label={`Average ${displaySettings.speedUnit.toUpperCase()} all-time`} value={formatSpeed(analytics.summary.averageWpm, displaySettings)} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label={`Average ${displaySettings.speedUnit.toUpperCase()} last 10`} value={formatSpeed(analytics.summary.averageWpmLast10, displaySettings)} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label={`Average ${displaySettings.speedUnit.toUpperCase()} last 100`} value={formatSpeed(analytics.summary.averageWpmLast100, displaySettings)} icon={<Activity className="h-4 w-4" />} />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-md border border-paper/10 bg-ink-900/80 px-4 py-4">
      <div className="flex items-center justify-between gap-3 text-brass">
        <p className="font-mono text-secondary uppercase text-paper/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-paper">{value}</p>
    </article>
  );
}

function Trends({
  range,
  results,
  onRangeChange
}: {
  range: TrendRange;
  results: SupabaseAnalyticsTypingResultRow[];
  onRangeChange: (range: TrendRange) => void;
}) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-section uppercase text-brass">Trends</h2>
          <p className="mt-1 font-mono text-secondary uppercase text-paper/35">WPM and accuracy over time</p>
        </div>
        <div className="flex rounded-full bg-paper/[0.035] p-1">
          {TREND_RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onRangeChange(option.id)}
              className={`rounded-full px-3 py-1.5 font-mono text-xs transition ${
                range === option.id ? "bg-brass/85 text-ink-950" : "text-paper/50 hover:bg-paper/5 hover:text-paper/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="WPM over time"
          unit="WPM"
          results={results}
          valueForResult={(result) => result.wpm}
          formatValue={formatNumber}
        />
        <TrendChart
          title="Accuracy over time"
          unit="Accuracy"
          results={results}
          valueForResult={(result) => result.accuracy}
          formatValue={(value) => `${formatNumber(value)}%`}
        />
      </div>
    </section>
  );
}

function TrendChart({
  title,
  unit,
  results,
  valueForResult,
  formatValue
}: {
  title: string;
  unit: string;
  results: SupabaseAnalyticsTypingResultRow[];
  valueForResult: (result: SupabaseAnalyticsTypingResultRow) => number;
  formatValue: (value: number) => string;
}) {
  const values = results.map(valueForResult);
  const points = buildChartPoints(values);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const fillPath =
    points.length > 1
      ? `${path} L ${points[points.length - 1].x.toFixed(2)} 174 L ${points[0].x.toFixed(2)} 174 Z`
      : "";
  const latest = values[values.length - 1] ?? 0;
  const best = values.length > 0 ? Math.max(...values) : 0;

  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-xs uppercase text-paper/70">{title}</h3>
          <p className="mt-1 font-mono text-secondary uppercase text-paper/35">{unit}</p>
        </div>
        <div className="text-right font-mono">
          <p className="text-lg text-paper">{formatValue(latest)}</p>
          <p className="text-secondary uppercase text-paper/35">Latest</p>
        </div>
      </div>
      <div className="mt-4 h-56 w-full overflow-hidden rounded-md bg-ink-950/70">
        <svg viewBox="0 0 420 220" role="img" aria-label={title} className="h-full w-full">
          <line data-testid="profile-trend-axis" x1="38" y1="174" x2="390" y2="174" stroke="rgb(var(--chart-axis))" />
          <line x1="38" y1="36" x2="38" y2="174" stroke="rgb(var(--chart-axis))" />
          <line data-testid="profile-trend-grid" x1="38" y1="105" x2="390" y2="105" stroke="rgb(var(--chart-grid))" strokeDasharray="5 7" />
          {points.length > 1 && (
            <>
              <path data-testid="profile-trend-fill" d={fillPath} fill="rgb(var(--chart-fill))" />
              <path
                data-testid="profile-trend-line"
                d={path}
                fill="none"
                stroke="rgb(var(--chart-line))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {points.map((point, index) => (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 4 : 3}
              fill={index === points.length - 1 ? "rgb(var(--chart-text))" : "rgb(var(--chart-line))"}
              stroke="rgb(var(--chart-tooltip-bg))"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-secondary uppercase text-paper/35">
        <span>{results[0] ? formatDate(results[0].created_at) : "No date"}</span>
        <span>Best {formatValue(best)}</span>
        <span>{results[results.length - 1] ? formatDate(results[results.length - 1].created_at) : "No date"}</span>
      </div>
    </section>
  );
}

const KEYBOARD_ROWS = getFullKeyboardLayout();

const HEATMAP_MODES: Array<{ id: HeatmapMode; label: string }> = [
  { id: "accuracy", label: "Accuracy" },
  { id: "speed", label: "Speed" },
  { id: "mistakes", label: "Mistakes" }
];

function TypingWeaknessesSection({
  statistics,
  heatmapMode,
  onHeatmapModeChange
}: {
  statistics: TypingStatistics;
  heatmapMode: HeatmapMode;
  onHeatmapModeChange: (mode: HeatmapMode) => void;
}) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const keysByCharacter = useMemo(
    () => new Map(statistics.keys.map((keyStatistic) => [keyStatistic.key, keyStatistic])),
    [statistics.keys]
  );
  const hasStatistics = statistics.keys.length > 0;

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-section uppercase text-brass">Typing Insights</h2>
          <p className="mt-1 font-mono text-secondary uppercase text-paper/35">
            Private insights from completed attempts
          </p>
        </div>
        <div className="flex rounded-full bg-paper/[0.035] p-1">
          {HEATMAP_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onHeatmapModeChange(mode.id)}
              className={`rounded-full px-3 py-1.5 font-mono text-xs transition ${
                heatmapMode === mode.id ? "bg-brass/85 text-ink-950" : "text-paper/50 hover:bg-paper/5 hover:text-paper/80"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {!hasStatistics ? (
        <p className="mt-4 text-sm leading-6 text-paper/50">
          Complete a new typing attempt to start collecting key-level insights. Older saved results are ignored here.
        </p>
      ) : (
        <>
          <details className="mt-5 rounded-md border border-paper/10 bg-ink-900/35">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-mono text-xs uppercase text-paper/60 transition hover:text-paper">
              <span>Keyboard heatmap</span><span className="text-paper/30">Open detailed key map</span>
            </summary>
            <div className="border-t border-paper/10 p-3"><KeyboardHeatmap keysByCharacter={keysByCharacter} mode={heatmapMode} /></div>
          </details>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <WeakKeysPanel keys={statistics.weakKeys} />
            <CommonMistakesPanel mistakes={statistics.commonMistakes} />
          </div>
          <section className="mt-4 rounded-md border border-paper/10 bg-ink-900/50">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen((current) => !current)}
              aria-expanded={isAdvancedOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-mono text-xs uppercase text-paper/60 transition hover:text-paper"
            >
              <span>{isAdvancedOpen ? "Hide advanced insights" : "Show advanced insights"}</span>
              <span aria-hidden="true">{isAdvancedOpen ? "−" : "+"}</span>
            </button>
            {isAdvancedOpen && (
              <div className="grid gap-4 border-t border-paper/10 p-4 lg:grid-cols-2 xl:grid-cols-4">
                <FingerAnalysisPanel statistics={statistics} />
                <ReactionTimePanel statistics={statistics} />
                <BurstSpeedPanel statistics={statistics} />
                <SpeedDropPanel statistics={statistics} />
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function KeyboardHeatmap({
  keysByCharacter,
  mode
}: {
  keysByCharacter: Map<string, KeyStatistic>;
  mode: HeatmapMode;
}) {
  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-xs uppercase text-paper/70">Keyboard Heatmap</h3>
          <p className="mt-1 font-mono text-secondary uppercase text-paper/35">{getHeatmapModeLabel(mode)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_11rem] xl:items-center">
        <div data-testid="keyboard-heatmap" className="space-y-2 overflow-x-auto pb-1">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div
            key={row.map((key) => key.key).join("-")}
            className={`flex min-w-max justify-center gap-1.5 ${rowIndex === 1 ? "pl-6" : rowIndex === 2 ? "pl-10" : rowIndex === 3 ? "pl-14" : ""}`}
          >
            {row.map((key) => {
              const keyStatistic = keysByCharacter.get(key.key);
              const style = getHeatmapKeyStyle(keyStatistic, mode, key);

              return (
                <div
                  key={key.key}
                  data-testid={`keyboard-key-${keyboardTestId(key.key)}`}
                  title={formatKeyStatisticTitle(keyStatistic)}
                  className="flex h-11 items-center justify-center rounded-md border px-2 font-mono text-xs text-paper opacity-95 transition-[background-color,border-color,opacity,transform] duration-200 ease-out hover:-translate-y-0.5 hover:opacity-100"
                  style={{
                    width: `${(key.width ?? 1) * 2.75}rem`,
                    ...style
                  }}
                >
                  <span>{key.label}</span>
                </div>
              );
            })}
          </div>
        ))}
        </div>
        <HeatmapLegend mode={mode} />
      </div>
    </section>
  );
}

function HeatmapLegend({ mode }: { mode: HeatmapMode }) {
  const rows =
    mode === "accuracy"
      ? [
          ["98%+", "var(--chart-positive)", 0.48],
          ["95-98%", "var(--chart-positive)", 0.3],
          ["90-95%", "var(--chart-warning)", 0.45],
          ["80-90%", "var(--chart-warning)", 0.7],
          ["<80%", "var(--chart-danger)", 0.75]
        ]
      : mode === "speed"
        ? [
            ["Fast", "var(--chart-line-secondary)", 0.22],
            ["Steady", "var(--chart-line-secondary)", 0.4],
            ["Slow", "var(--chart-line-secondary)", 0.7]
          ]
        : [
            ["Few", "var(--chart-warning)", 0.25],
            ["Some", "var(--chart-warning)", 0.5],
            ["Many", "var(--chart-warning)", 0.8]
          ];

  return (
    <div className="rounded-md border border-paper/10 bg-ink-950/45 p-3">
      <p className="font-mono text-secondary uppercase text-paper/45">Legend</p>
      <div className="mt-3 space-y-2">
        {rows.map(([label, color, opacity]) => (
          <div key={String(label)} className="flex items-center gap-2 font-mono text-secondary uppercase text-paper/40">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: `rgb(${color} / ${opacity})` }}
              aria-hidden="true"
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeakKeysPanel({ keys }: { keys: KeyStatistic[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-paper/10 bg-ink-900/70">
      <div className="border-b border-paper/10 px-4 py-3">
        <h3 className="font-mono text-xs uppercase text-paper/70">Weak Keys</h3>
      </div>
      {keys.length === 0 ? (
        <p className="px-4 py-4 text-sm leading-6 text-paper/50">More samples needed before ranking weak keys.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[2.5rem_1fr_4rem_4rem] gap-3 border-b border-paper/10 px-4 py-2 font-mono text-secondary uppercase text-paper/35">
            <span>Key</span>
            <span>Accuracy</span>
            <span>Mistakes</span>
            <span>Hits</span>
          </div>
          {keys.slice(0, 5).map((keyStatistic) => (
            <article
              key={keyStatistic.key}
              className="grid grid-cols-[2.5rem_1fr_4rem_4rem] items-center gap-3 border-b border-paper/10 px-4 py-3 last:border-b-0"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ember/25 bg-ember/10 font-mono text-sm text-paper">
                {formatKeyLabel(keyStatistic.key)}
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xs text-paper">{formatNumber(keyStatistic.accuracy)}% accuracy</p>
              </div>
              <p className="font-mono text-xs text-paper/65">{keyStatistic.mistakeCount}</p>
              <p className="font-mono text-xs text-paper/65">{keyStatistic.hitCount}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CommonMistakesPanel({ mistakes }: { mistakes: TypingStatistics["commonMistakes"] }) {
  return (
    <section className="overflow-hidden rounded-md border border-paper/10 bg-ink-900/70">
      <div className="border-b border-paper/10 px-4 py-3">
        <h3 className="font-mono text-xs uppercase text-paper/70">Common Mistakes</h3>
      </div>
      {mistakes.length === 0 ? (
        <p className="px-4 py-4 text-sm leading-6 text-paper/50">No repeated mistake patterns yet.</p>
      ) : (
        <div>
          {mistakes.slice(0, 5).map((mistake) => (
            <article
              key={mistake.id}
              className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-3 border-b border-paper/10 px-4 py-3 last:border-b-0"
            >
              <p className="min-w-0 text-sm text-paper/70">{formatMistakeLabel(mistake)}</p>
              <span className="rounded-full border border-paper/10 bg-paper/[0.035] px-2 py-1 font-mono text-secondary uppercase text-paper/45">
                {mistake.count}x
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentErrorReplayPanel({ attempt }: { attempt: TypingAttemptDetail | null }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showOnlyMistakes, setShowOnlyMistakes] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const events = useMemo(() => buildTypingReplayEvents(attempt, { onlyMistakes: showOnlyMistakes }), [attempt, showOnlyMistakes]);
  const durationMs = events.length > 0 ? Math.max(...events.map((event) => event.timeMs), 1) : 0;
  const activeEvent = getActiveReplayEvent(events, currentTimeMs);
  const visibleMistakeEvents = events.filter((event) => event.isMistake && event.timeMs <= currentTimeMs).slice(-5);

  useEffect(() => {
    setCurrentTimeMs(0);
    setIsPlaying(false);
  }, [attempt, showOnlyMistakes]);

  useEffect(() => {
    if (!isPlaying || durationMs === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentTimeMs((currentTime) => {
        const nextTime = currentTime + 120 * speed;

        if (nextTime >= durationMs) {
          setIsPlaying(false);
          return durationMs;
        }

        return nextTime;
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [durationMs, isPlaying, speed]);

  if (!attempt || events.length === 0 || durationMs === 0) {
    return (
      <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
        <h3 className="font-mono text-xs uppercase text-paper/70">Recent Error Replay</h3>
        <p className="mt-3 text-sm leading-6 text-paper/50">Replay will appear after a completed attempt with timing data.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-xs uppercase text-paper/70">Recent Error Replay</h3>
          <p className="mt-1 text-sm leading-6 text-paper/45">Replay your latest attempt showing where mistakes happened.</p>
        </div>
        <label className="flex items-center gap-2 font-mono text-xs text-paper/55">
          <span>Show only mistakes</span>
          <input
            type="checkbox"
            aria-label="Show only mistakes"
            checked={showOnlyMistakes}
            onChange={(event) => setShowOnlyMistakes(event.target.checked)}
            className="accent-brass"
          />
        </label>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-md bg-paper/[0.025] p-2">
        <ReplayPathOverlay events={visibleMistakeEvents} />
        <div className="relative z-10 space-y-1.5">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={row.map((key) => key.key).join("-")} className={`flex min-w-max justify-center gap-1 ${rowIndex === 1 ? "pl-5" : rowIndex === 2 ? "pl-8" : rowIndex === 3 ? "pl-11" : ""}`}>
              {row.map((key) => {
                const isActive = activeEvent?.key === key.key;
                const isMistake = isActive && activeEvent?.isMistake;

                return (
                  <div
                    key={key.key}
                    className={`flex h-8 items-center justify-center rounded border px-1.5 font-mono text-secondary transition ${
                      isMistake
                        ? "border-ember/50 bg-ember/70 text-ink-950"
                        : isActive
                          ? "border-brass/50 bg-brass/50 text-ink-950"
                          : "border-paper/10 bg-paper/[0.055] text-paper/65"
                    }`}
                    style={{ width: `${(key.width ?? 1) * 2.2}rem` }}
                  >
                    {key.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-md border border-paper/10 bg-ink-950/35 p-2 sm:grid-cols-[auto_5rem_minmax(0,1fr)_4.5rem] sm:items-center">
        <button
          type="button"
          onClick={() => setIsPlaying((current) => !current)}
          className="rounded-md border border-paper/10 bg-paper/[0.04] px-3 py-2 font-mono text-xs text-paper/75 transition hover:border-brass/40 hover:text-paper"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <select
          aria-label="Replay speed"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="rounded-md border border-paper/10 bg-ink-900 px-2 py-2 font-mono text-xs text-paper/75"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>
        <input
          type="range"
          min={0}
          max={durationMs}
          value={currentTimeMs}
          aria-label="Replay timeline"
          onChange={(event) => {
            setCurrentTimeMs(Number(event.target.value));
            setIsPlaying(false);
          }}
          className="w-full accent-brass"
        />
        <p className="text-right font-mono text-secondary text-paper/45">
          {formatReplayTime(currentTimeMs)} / {formatReplayTime(durationMs)}
        </p>
      </div>

      {visibleMistakeEvents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleMistakeEvents.map((event, index) => (
            <span key={event.id} className="rounded-full border border-paper/10 bg-paper/[0.035] px-2 py-1 font-mono text-secondary text-paper/60">
              {index + 1}. Expected: {formatKeyLabel(event.expected)} {"->"} Typed: {formatKeyLabel(event.actual)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function ReplayPathOverlay({ events }: { events: TypingReplayEvent[] }) {
  const points = events
    .map((event) => getReplayKeyPoint(event.key))
    .filter((point): point is { x: number; y: number } => Boolean(point));
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 100 58" preserveAspectRatio="none" aria-hidden="true">
      {points.length > 1 && <polyline points={path} fill="none" stroke="rgb(var(--chart-danger) / 0.55)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => (
        <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="1.4" fill="rgb(var(--chart-danger) / 0.8)" />
      ))}
    </svg>
  );
}

function FingerAnalysisPanel({ statistics }: { statistics: TypingStatistics }) {
  const fingers = [...statistics.fingers]
    .sort((first, second) => first.accuracy - second.accuracy || second.hitCount - first.hitCount)
    .slice(0, 4);

  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <h3 className="font-mono text-xs uppercase text-paper/70">Finger Analysis</h3>
      <div className="mt-3 space-y-2">
        {fingers.length === 0 ? (
          <p className="text-sm leading-6 text-paper/50">More key data needed.</p>
        ) : (
          fingers.map((finger) => (
            <div key={finger.finger} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-paper">{finger.finger}</p>
                <p className="mt-0.5 font-mono text-secondary uppercase text-paper/35">
                  {finger.hitCount} hits · {formatDelay(finger.averageDelayMs)}
                </p>
              </div>
              <p className="font-mono text-lg text-paper">{formatNumber(finger.accuracy)}%</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ReactionTimePanel({ statistics }: { statistics: TypingStatistics }) {
  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <h3 className="font-mono text-xs uppercase text-paper/70">Reaction Time</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <CompactInsightMetric label="Average Keystroke" value={formatDelay(statistics.reactionTime.averageKeystrokeMs)} />
        <CompactInsightMetric label="Correct" value={formatDelay(statistics.reactionTime.correctKeystrokeMs)} />
        <CompactInsightMetric label="Wrong" value={formatDelay(statistics.reactionTime.wrongKeystrokeMs)} />
      </div>
    </section>
  );
}

function BurstSpeedPanel({ statistics }: { statistics: TypingStatistics }) {
  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <h3 className="font-mono text-xs uppercase text-paper/70">Burst Speed</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <CompactInsightMetric label="Peak 3s" value={formatNullableWpm(statistics.burstSpeed.peak3SecondWpm)} />
        <CompactInsightMetric label="Peak 5s" value={formatNullableWpm(statistics.burstSpeed.peak5SecondWpm)} />
        <CompactInsightMetric label="Peak 10s" value={formatNullableWpm(statistics.burstSpeed.peak10SecondWpm)} />
      </div>
    </section>
  );
}

function SpeedDropPanel({ statistics }: { statistics: TypingStatistics }) {
  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <h3 className="font-mono text-xs uppercase text-paper/70">Speed Drop</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <CompactInsightMetric label="Start" value={formatNullableWpm(statistics.speedDrop.startWpm)} />
        <CompactInsightMetric label="Middle" value={formatNullableWpm(statistics.speedDrop.middleWpm)} />
        <CompactInsightMetric label="End" value={formatNullableWpm(statistics.speedDrop.endWpm)} />
      </div>
      <p className="mt-3 font-mono text-secondary uppercase text-paper/35">
        Avg slowdown {statistics.speedDrop.averageSlowdownPercent === null ? "n/a" : `${formatNumber(statistics.speedDrop.averageSlowdownPercent)}%`}
      </p>
    </section>
  );
}

function CompactInsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-paper/[0.035] px-2 py-2">
      <p className="font-mono text-secondary uppercase leading-4 text-paper/35">{label}</p>
      <p className="mt-1 font-mono text-sm text-paper">{value}</p>
    </div>
  );
}

function ConsistencySection({ summary }: { summary: ReturnType<typeof buildAttemptConsistencySummary> }) {
  const path = getConsistencyScorePath(summary.points, 320, 96);

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-section uppercase text-brass">Consistency</h2>
      {summary.latest === null ? (
        <>
          <p className="mt-4 font-mono text-lg text-paper">Not enough data yet</p>
          <p className="mt-2 text-sm leading-6 text-paper/50">Complete a test with at least three speed samples to measure typing stability.</p>
        </>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CompactInsightMetric label="Latest" value={`${formatNumber(summary.latest)}%`} />
            <CompactInsightMetric label="Average" value={`${formatNumber(summary.average ?? 0)}%`} />
            <CompactInsightMetric label="Best" value={`${formatNumber(summary.best ?? 0)}%`} />
            <CompactInsightMetric
              label="Recent change"
              value={summary.recentChange === null ? "New" : `${summary.recentChange >= 0 ? "+" : ""}${formatNumber(summary.recentChange)}%`}
            />
          </div>
          <div className="mt-4 rounded-md bg-paper/[0.025] p-3">
            {path ? (
              <svg viewBox="0 0 320 96" role="img" aria-label="Consistency trend" className="h-24 w-full">
                <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-brass" />
              </svg>
            ) : (
              <p className="py-8 text-center font-mono text-xs text-paper/35">One measured attempt</p>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-paper/40">Based on variation in WPM throughout each attempt. Higher is steadier.</p>
        </>
      )}
    </section>
  );
}

function CategoryBreakdown({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-section uppercase text-brass">Category Breakdown</h2>
        {analytics.weakestCategory && (
          <p className="mt-2 font-mono text-xs text-paper/45">Weakest: {analytics.weakestCategory.category}</p>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_5rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-sm:hidden md:px-5">
        <span>Category</span>
        <span>Avg WPM</span>
        <span>Avg Accuracy</span>
        <span>Tests</span>
      </div>
      {analytics.categoryBreakdown.map((row) => {
        const isWeakest = analytics.weakestCategory?.category === row.category;

        return (
          <article
            key={row.category}
            className={`grid gap-2 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem] sm:items-center md:px-5 ${
              isWeakest ? "" : "border-paper/10"
            }`}
            style={
              isWeakest
                ? {
                    borderColor: "rgb(var(--chart-warning) / 0.24)",
                    backgroundColor: "rgb(var(--chart-warning) / 0.1)"
                  }
                : undefined
            }
          >
            <h3 className="font-semibold text-paper">{row.category}</h3>
            <BreakdownMetric label="Avg WPM" value={formatNumber(row.averageWpm)} />
            <BreakdownMetric label="Avg Accuracy" value={`${formatNumber(row.averageAccuracy)}%`} />
            <BreakdownMetric label="Tests" value={row.tests} />
          </article>
        );
      })}
    </section>
  );
}

function ActivitySection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  const recentDates = analytics.activity.activeDates.slice(-14);

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-section uppercase text-brass">Activity</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Current streak" value={`${analytics.activity.currentStreakDays} days`} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label="Active days" value={analytics.activity.activeDays} icon={<Clock className="h-4 w-4" />} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Recent active days">
        {recentDates.map((date) => (
          <span key={date} title={date} className="h-4 w-4 rounded-sm bg-brass/70" />
        ))}
      </div>
    </section>
  );
}

function ResultMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="font-mono text-secondary uppercase text-paper/35 md:hidden">{label}</div>
      <div className={`font-mono text-sm ${strong ? "font-semibold text-paper" : "text-paper/65"}`}>{value}</div>
    </div>
  );
}

function BreakdownMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-secondary uppercase text-paper/35 sm:hidden">{label}</p>
      <p className="font-mono text-sm text-paper/70">{value}</p>
    </div>
  );
}

function getTrendResults(results: SupabaseAnalyticsTypingResultRow[], range: TrendRange) {
  const sorted = [...results].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  const limited = range === "all" ? sorted : sorted.slice(0, Number(range));
  return limited.reverse();
}

function buildChartPoints(values: number[]) {
  if (values.length === 0) {
    return [];
  }

  const left = 38;
  const right = 390;
  const top = 30;
  const bottom = 178;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? (right - left) / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: values.length > 1 ? left + step * index : (left + right) / 2,
    y: bottom - ((value - min) / range) * (bottom - top)
  }));
}

function getHeatmapKeyStyle(keyStatistic: KeyStatistic | undefined, mode: HeatmapMode, key: { key: string }) {
  if (!keyStatistic || keyStatistic.hitCount < 20) {
    return {
      backgroundColor: "rgb(var(--color-paper) / 0.035)",
      borderColor: "rgb(var(--color-paper) / 0.08)",
      opacity: key.key.length > 1 && key.key !== " " ? 0.78 : 0.68
    };
  }

  const intensity = getHeatmapIntensity(keyStatistic, mode);
  return {
    backgroundColor: `rgb(var(${getHeatmapColorVariable(mode)}) / ${intensity})`,
    borderColor: `rgb(var(${getHeatmapColorVariable(mode)}) / ${Math.min(0.52, intensity + 0.08)})`,
    opacity: 1
  };
}

function getHeatmapIntensity(keyStatistic: KeyStatistic, mode: HeatmapMode) {
  if (mode === "accuracy") {
    return 0.12 + ((100 - keyStatistic.accuracy) / 100) * 0.72;
  }

  if (mode === "mistakes") {
    return Math.min(0.88, 0.12 + keyStatistic.mistakeCount * 0.12);
  }

  if (!keyStatistic.averageDelayMs) {
    return 0.08;
  }

  return Math.min(0.88, 0.12 + Math.max(0, keyStatistic.averageDelayMs - 100) / 500);
}

function getHeatmapColorVariable(mode: HeatmapMode) {
  return mode === "accuracy" ? "--chart-danger" : mode === "mistakes" ? "--chart-warning" : "--chart-line-secondary";
}

function getHeatmapModeLabel(mode: HeatmapMode) {
  return mode === "accuracy" ? "Lower accuracy glows hotter" : mode === "speed" ? "Slower keys glow brighter" : "More mistakes glow brighter";
}

function formatKeyStatisticTitle(keyStatistic: KeyStatistic | undefined) {
  if (!keyStatistic || keyStatistic.hitCount < 20) {
    const hitCount = keyStatistic?.hitCount ?? 0;
    return `Not enough data (${hitCount} ${hitCount === 1 ? "hit" : "hits"})`;
  }

  const delay = keyStatistic.averageDelayMs === null ? "delay unavailable" : `${keyStatistic.averageDelayMs}ms avg delay`;

  return `${formatKeyLabel(keyStatistic.key)}: ${keyStatistic.hitCount} hits, ${formatNumber(keyStatistic.accuracy)}% accuracy, ${keyStatistic.mistakeCount} mistakes, ${delay}`;
}

function formatMistakeLabel(mistake: TypingStatistics["commonMistakes"][number]) {
  if (mistake.type === "missed") {
    return `missed ${formatKeyLabel(mistake.expected)}`;
  }

  if (mistake.type === "extra") {
    return `extra ${formatKeyLabel(mistake.actual)}`;
  }

  return `expected ${formatKeyLabel(mistake.expected)}, typed ${formatKeyLabel(mistake.actual)}`;
}

function formatKeyLabel(key: string) {
  if (!key) {
    return "none";
  }

  if (key === " ") {
    return "space";
  }

  if (key === "\n") {
    return "enter";
  }

  return key;
}

function keyboardTestId(key: string) {
  if (key === " ") {
    return "space";
  }

  return key.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "key";
}

function getActiveReplayEvent(events: TypingReplayEvent[], currentTimeMs: number) {
  return [...events].reverse().find((event) => event.timeMs <= currentTimeMs) ?? events[0] ?? null;
}

function getReplayKeyPoint(key: string) {
  for (let rowIndex = 0; rowIndex < KEYBOARD_ROWS.length; rowIndex += 1) {
    const row = KEYBOARD_ROWS[rowIndex];
    const totalWidth = row.reduce((total, layoutKey) => total + (layoutKey.width ?? 1), 0);
    let cursor = (14 - totalWidth) / 2;

    for (const layoutKey of row) {
      const width = layoutKey.width ?? 1;

      if (layoutKey.key === key) {
        return {
          x: ((cursor + width / 2) / 14) * 100,
          y: 8 + rowIndex * 10
        };
      }

      cursor += width;
    }
  }

  return null;
}

function formatReplayTime(valueMs: number) {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDelay(value: number | null) {
  return value === null ? "n/a" : `${value} ms`;
}

function formatNullableWpm(value: number | null) {
  return value === null ? "n/a" : `${formatNumber(value)}`;
}

function formatNumber(value: number) {
  return Number(value).toFixed(1);
}

function formatSpeed(wpm: number, settings: ProfileDisplaySettings) {
  const value = settings.speedUnit === "cpm" ? wpm * 5 : wpm;
  return settings.showDecimals ? Number(value).toFixed(1) : String(Math.round(value));
}

function getPublicProfileUrl(handle: string) {
  return `${getSiteUrl()}/u/${handle}`;
}

function getAvatarStyleClass(style: string) {
  if (style === "slate") {
    return "border-paper/15 bg-paper/[0.06] text-paper/65";
  }

  if (style === "ember") {
    return "border-ember/25 bg-ember/10 text-ember";
  }

  return "border-brass/25 bg-brass/10 text-brass";
}

function formatJoinedDate(createdAt?: string | null) {
  if (!createdAt) {
    return "Joined date unavailable";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Joined date unavailable";
  }

  return `Joined ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  })}`;
}

async function prepareAvatarUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PNG, JPG, or WebP image.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Avatar image must be 2MB or smaller.");
  }

  if (
    typeof window === "undefined" ||
    typeof createImageBitmap === "undefined" ||
    typeof document === "undefined"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(
      bitmap,
      Math.floor((bitmap.width - size) / 2),
      Math.floor((bitmap.height - size) / 2),
      size,
      size,
      0,
      0,
      512,
      512
    );

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));

    if (!blob || blob.size > 2 * 1024 * 1024) {
      return file;
    }

    return new File([blob], "avatar.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

function formatPracticeTime(seconds: number) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "Infinite";
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
