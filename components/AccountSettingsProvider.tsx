"use client";

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  type AccountSettingsSaveResult,
  type AccountSettingsV1,
  createDefaultAccountSettings,
  hydrateAccountSettings,
  normalizeAccountSettings,
  readLocalAccountSettings,
  supabaseAccountSettingsRepository,
  writeLocalAccountSettings
} from "@/lib/accountSettings";
import { LOCAL_ACCOUNT_SETTINGS_MUTATION_EVENT } from "@/lib/settingsEvents";

export type AccountSettingsSyncState = "loading" | "saved" | "local_fallback" | "save_failed";

type AccountSettingsContextValue = {
  settings: AccountSettingsV1;
  syncState: AccountSettingsSyncState;
  saveSettings(settings: AccountSettingsV1): Promise<AccountSettingsSaveResult>;
  updateSettings(
    updater: (settings: AccountSettingsV1) => AccountSettingsV1
  ): Promise<AccountSettingsSaveResult>;
};

const AccountSettingsContext = createContext<AccountSettingsContextValue | null>(null);

interface AccountSettingsProviderProps {
  children: ReactNode;
  renderChildrenWhileHydrating?: boolean;
}

export function AccountSettingsProvider({
  children,
  renderChildrenWhileHydrating = false
}: AccountSettingsProviderProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [settings, setSettings] = useState<AccountSettingsV1 | null>(null);
  const [hydratedAccountKey, setHydratedAccountKey] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<AccountSettingsSyncState>("loading");
  const currentSettingsRef = useRef<AccountSettingsV1 | null>(null);
  const hydratingRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveRevisionRef = useRef(0);
  const accountGenerationRef = useRef(0);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;
  const accountKey = user?.id ?? "anonymous";

  useEffect(() => {
    if (isAuthLoading) {
      setSyncState("loading");
      return;
    }

    let cancelled = false;
    const generation = ++accountGenerationRef.current;
    const userId = user?.id ?? null;
    const switchedAuthenticatedAccount = Boolean(
      userId &&
      lastAuthenticatedUserIdRef.current &&
      lastAuthenticatedUserIdRef.current !== userId
    );
    if (userId) lastAuthenticatedUserIdRef.current = userId;
    hydratingRef.current = true;
    currentSettingsRef.current = null;
    setSettings(null);
    setHydratedAccountKey(null);
    setSyncState("loading");
    saveQueueRef.current = Promise.resolve();
    saveRevisionRef.current = 0;
    const localSettings = switchedAuthenticatedAccount
      ? createDefaultAccountSettings()
      : readLocalAccountSettings();

    void hydrateAccountSettings({
      userId,
      repository: supabaseAccountSettingsRepository,
      localSettings
    })
      .then((result) => {
        if (cancelled || accountGenerationRef.current !== generation) return;
        const hydratedSettings = writeLocalAccountSettings(result.settings);
        currentSettingsRef.current = hydratedSettings;
        setSettings(hydratedSettings);
        setHydratedAccountKey(accountKey);
        setSyncState(result.source === "local_fallback" ? "local_fallback" : "saved");
      })
      .catch(() => {
        if (cancelled || accountGenerationRef.current !== generation) return;
        const fallbackSettings = userId
          ? writeLocalAccountSettings(createDefaultAccountSettings())
          : writeLocalAccountSettings(localSettings);
        currentSettingsRef.current = fallbackSettings;
        setSettings(fallbackSettings);
        setHydratedAccountKey(accountKey);
        setSyncState(userId ? "save_failed" : "local_fallback");
      })
      .finally(() => {
        if (!cancelled) hydratingRef.current = false;
      });

    return () => {
      cancelled = true;
      hydratingRef.current = false;
    };
  }, [accountKey, isAuthLoading, user?.id]);

  const saveSettings = useCallback((nextSettings: AccountSettingsV1) => {
    const localSettings = writeLocalAccountSettings(normalizeAccountSettings(nextSettings));
    const userId = userIdRef.current;
    const generation = accountGenerationRef.current;
    const revision = ++saveRevisionRef.current;
    currentSettingsRef.current = localSettings;
    setSettings(localSettings);
    setSyncState(userId ? "loading" : "local_fallback");

    if (!userId) {
      return Promise.resolve({
        settings: localSettings,
        status: "local_fallback" as const
      });
    }

    const save = saveQueueRef.current
      .catch(() => undefined)
      .then(async (): Promise<AccountSettingsSaveResult> => {
        try {
          await supabaseAccountSettingsRepository.save(userId, localSettings);
          return { settings: localSettings, status: "saved" };
        } catch {
          return { settings: localSettings, status: "save_failed" };
        }
      });
    saveQueueRef.current = save;

    return save.then((result) => {
      if (
        saveRevisionRef.current === revision &&
        accountGenerationRef.current === generation &&
        userIdRef.current === userId &&
        currentSettingsRef.current === localSettings
      ) {
        setSyncState(result.status);
      }
      return result;
    });
  }, []);

  const updateSettings = useCallback((
    updater: (settings: AccountSettingsV1) => AccountSettingsV1
  ) => {
    const current = currentSettingsRef.current;
    if (!current) {
      return Promise.reject(new Error("Account settings are still loading."));
    }
    return saveSettings(updater(current));
  }, [saveSettings]);

  useEffect(() => {
    let queued = false;
    const handleLocalMutation = () => {
      if (hydratingRef.current || queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (hydratingRef.current) return;
        const next = readLocalAccountSettings();
        if (JSON.stringify(next) === JSON.stringify(currentSettingsRef.current)) return;
        void saveSettings(next);
      });
    };

    window.addEventListener(LOCAL_ACCOUNT_SETTINGS_MUTATION_EVENT, handleLocalMutation);
    return () => window.removeEventListener(LOCAL_ACCOUNT_SETTINGS_MUTATION_EVENT, handleLocalMutation);
  }, [saveSettings]);

  const value = useMemo<AccountSettingsContextValue | null>(
    () => settings && hydratedAccountKey === accountKey
      ? { settings, syncState, saveSettings, updateSettings }
      : null,
    [accountKey, hydratedAccountKey, saveSettings, settings, syncState, updateSettings]
  );

  // Authenticated cloud values must be resolved before application pages read
  // legacy local adapters; this prevents a default/local flash and overwrite.
  if (!value || isAuthLoading) {
    return renderChildrenWhileHydrating
      ? <AccountSettingsContext.Provider value={null}>{children}</AccountSettingsContext.Provider>
      : null;
  }

  return <AccountSettingsContext.Provider value={value}>{children}</AccountSettingsContext.Provider>;
}

export function useAccountSettings() {
  const context = useContext(AccountSettingsContext);
  if (!context) {
    throw new Error("useAccountSettings must be used inside AccountSettingsProvider");
  }
  return context;
}

export function useOptionalAccountSettings() {
  return useContext(AccountSettingsContext);
}
