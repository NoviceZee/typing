import {
  ALL_FILTER,
  DEFAULT_THEME_SETTINGS,
  type CategoryFilter,
  type PassageLanguage,
  type StyleFilter,
  type ThemeSettings,
  normaliseThemeSettings,
  readSelectedCategory,
  readSelectedLanguage,
  readSelectedStyle,
  readStoredRules,
  readThemeSettings,
  writeSelectedCategory,
  writeSelectedLanguage,
  writeSelectedStyle,
  writeStoredRules,
  writeThemeSettings
} from "@/lib/app-storage";
import {
  DEFAULT_KEYBOARD_SOUND_VOLUME,
  type KeyboardSoundSetting,
  isKeyboardSoundSetting,
  normalizeKeyboardSoundVolume,
  readKeyboardSoundSetting,
  readKeyboardSoundVolume,
  writeKeyboardSoundSetting,
  writeKeyboardSoundVolume
} from "@/lib/keyboardSound";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  readNotificationSettings,
  writeNotificationSettings
} from "@/lib/notificationSettings";
import {
  DEFAULT_PROFILE_DISPLAY_SETTINGS,
  type ProfileDisplaySettings,
  readProfileDisplaySettings,
  writeProfileDisplaySettings
} from "@/lib/profileDisplaySettings";
import { DEFAULT_RULES, type TypingRules } from "@/lib/typing-engine";
import { supabase } from "@/lib/supabaseClient";

export const ACCOUNT_SETTINGS_VERSION = 1 as const;
export const ACCOUNT_SETTINGS_CHANGE_EVENT = "typing-station-account-settings-change";

export type AccountSettingsV1 = {
  version: typeof ACCOUNT_SETTINGS_VERSION;
  appearance: ThemeSettings;
  behavior: TypingRules;
  sound: {
    keyboard: KeyboardSoundSetting;
    volume: number;
  };
  notifications: NotificationSettings;
  profileDisplay: ProfileDisplaySettings;
  preferences: {
    language: PassageLanguage;
    category: CategoryFilter;
    style: StyleFilter;
  };
};

export type AccountSettingsRepository = {
  load(userId: string): Promise<AccountSettingsV1 | null>;
  save(userId: string, settings: AccountSettingsV1): Promise<void>;
};

export type AccountSettingsHydrationResult = {
  settings: AccountSettingsV1;
  source: "cloud" | "migrated" | "local_fallback";
};

export type AccountSettingsSaveResult = {
  settings: AccountSettingsV1;
  status: "saved" | "local_fallback" | "save_failed";
};

export function createDefaultAccountSettings(): AccountSettingsV1 {
  return {
    version: ACCOUNT_SETTINGS_VERSION,
    appearance: { ...DEFAULT_THEME_SETTINGS },
    behavior: { ...DEFAULT_RULES },
    sound: {
      keyboard: "off",
      volume: DEFAULT_KEYBOARD_SOUND_VOLUME
    },
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    profileDisplay: { ...DEFAULT_PROFILE_DISPLAY_SETTINGS },
    preferences: {
      language: "english",
      category: ALL_FILTER,
      style: ALL_FILTER
    }
  };
}

export function readLocalAccountSettings(): AccountSettingsV1 {
  if (typeof window === "undefined") {
    return createDefaultAccountSettings();
  }

  return normalizeAccountSettings({
    version: ACCOUNT_SETTINGS_VERSION,
    appearance: readThemeSettings(),
    behavior: readStoredRules(),
    sound: {
      keyboard: readKeyboardSoundSetting(),
      volume: readKeyboardSoundVolume()
    },
    notifications: readNotificationSettings(),
    profileDisplay: readProfileDisplaySettings(),
    preferences: {
      language: readSelectedLanguage(),
      category: readSelectedCategory(),
      style: readSelectedStyle()
    }
  });
}

export function writeLocalAccountSettings(settings: AccountSettingsV1) {
  const normalized = normalizeAccountSettings(settings);
  writeThemeSettings(normalized.appearance);
  writeStoredRules(normalized.behavior);
  writeKeyboardSoundSetting(normalized.sound.keyboard);
  writeKeyboardSoundVolume(normalized.sound.volume);
  writeNotificationSettings(normalized.notifications);
  writeProfileDisplaySettings(normalized.profileDisplay);
  writeSelectedLanguage(normalized.preferences.language);
  writeSelectedCategory(normalized.preferences.category);
  writeSelectedStyle(normalized.preferences.style);

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(ACCOUNT_SETTINGS_CHANGE_EVENT, { detail: normalized }));
  }
  return normalized;
}

export async function hydrateAccountSettings({
  userId,
  repository,
  localSettings
}: {
  userId: string | null;
  repository: AccountSettingsRepository;
  localSettings: AccountSettingsV1;
}): Promise<AccountSettingsHydrationResult> {
  const local = normalizeAccountSettings(localSettings);
  if (!userId) {
    return { settings: local, source: "local_fallback" };
  }

  const cloud = await repository.load(userId);
  if (cloud) {
    return { settings: normalizeAccountSettings(cloud), source: "cloud" };
  }

  await repository.save(userId, local);
  return { settings: local, source: "migrated" };
}

export async function persistAccountSettings({
  userId,
  repository,
  settings
}: {
  userId: string | null;
  repository: AccountSettingsRepository;
  settings: AccountSettingsV1;
}): Promise<AccountSettingsSaveResult> {
  const local = writeLocalAccountSettings(normalizeAccountSettings(settings));
  if (!userId) {
    return { settings: local, status: "local_fallback" };
  }

  try {
    await repository.save(userId, local);
    return { settings: local, status: "saved" };
  } catch {
    return { settings: local, status: "save_failed" };
  }
}

export function normalizeAccountSettings(value: unknown): AccountSettingsV1 {
  const defaults = createDefaultAccountSettings();
  if (!isRecord(value)) {
    return defaults;
  }

  const behavior = isRecord(value.behavior) ? value.behavior : {};
  const sound = isRecord(value.sound) ? value.sound : {};
  const notifications = isRecord(value.notifications) ? value.notifications : {};
  const profileDisplay = isRecord(value.profileDisplay) ? value.profileDisplay : {};
  const preferences = isRecord(value.preferences) ? value.preferences : {};

  return {
    version: ACCOUNT_SETTINGS_VERSION,
    appearance: normaliseThemeSettings(value.appearance),
    behavior: {
      requireTabToStart: booleanOr(behavior.requireTabToStart, defaults.behavior.requireTabToStart),
      requireTwoSpacesAfterPeriod: booleanOr(
        behavior.requireTwoSpacesAfterPeriod,
        defaults.behavior.requireTwoSpacesAfterPeriod
      ),
      enforceUppercase: booleanOr(behavior.enforceUppercase, defaults.behavior.enforceUppercase),
      enforceLowercase: booleanOr(behavior.enforceLowercase, defaults.behavior.enforceLowercase),
      caseSensitive: booleanOr(behavior.caseSensitive, defaults.behavior.caseSensitive),
      punctuationSensitive: booleanOr(behavior.punctuationSensitive, defaults.behavior.punctuationSensitive),
      enforceExtraSpaces: booleanOr(behavior.enforceExtraSpaces, defaults.behavior.enforceExtraSpaces),
      enforceMissingSpaces: booleanOr(behavior.enforceMissingSpaces, defaults.behavior.enforceMissingSpaces),
      autoCapitalisationHints: booleanOr(
        behavior.autoCapitalisationHints,
        defaults.behavior.autoCapitalisationHints
      ),
      showMistakesImmediately: booleanOr(
        behavior.showMistakesImmediately,
        defaults.behavior.showMistakesImmediately
      ),
      allowBackspace: booleanOr(behavior.allowBackspace, defaults.behavior.allowBackspace)
    },
    sound: {
      keyboard: isKeyboardSoundSetting(sound.keyboard) ? sound.keyboard : defaults.sound.keyboard,
      volume: normalizeKeyboardSoundVolume(sound.volume)
    },
    notifications: {
      achievements: booleanOr(notifications.achievements, defaults.notifications.achievements),
      friendRequests: booleanOr(notifications.friendRequests, defaults.notifications.friendRequests),
      weeklySummary: booleanOr(notifications.weeklySummary, defaults.notifications.weeklySummary)
    },
    profileDisplay: {
      speedUnit: profileDisplay.speedUnit === "cpm" ? "cpm" : "wpm",
      showDecimals: booleanOr(profileDisplay.showDecimals, defaults.profileDisplay.showDecimals),
      defaultTrendRange:
        profileDisplay.defaultTrendRange === "90" || profileDisplay.defaultTrendRange === "all"
          ? profileDisplay.defaultTrendRange
          : "30"
    },
    preferences: {
      language: preferences.language === "chinese" ? "chinese" : "english",
      category: typeof preferences.category === "string"
        ? preferences.category as CategoryFilter
        : defaults.preferences.category,
      style: typeof preferences.style === "string" ? preferences.style : defaults.preferences.style
    }
  };
}

export const supabaseAccountSettingsRepository: AccountSettingsRepository = {
  async load(userId) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("user_settings")
      .select("settings,settings_version")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.settings) return null;
    return normalizeAccountSettings(data.settings);
  },
  async save(userId, settings) {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        settings_version: ACCOUNT_SETTINGS_VERSION,
        settings: normalizeAccountSettings(settings)
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
