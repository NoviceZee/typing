export type ProfileDisplaySettings = { speedUnit: "wpm" | "cpm"; showDecimals: boolean; defaultTrendRange: "30" | "90" | "all" };
export const DEFAULT_PROFILE_DISPLAY_SETTINGS: ProfileDisplaySettings = { speedUnit: "wpm", showDecimals: true, defaultTrendRange: "30" };
const KEY = "formaltype_profile_display_settings";

export function readProfileDisplaySettings(): ProfileDisplaySettings {
  if (typeof window === "undefined") return DEFAULT_PROFILE_DISPLAY_SETTINGS;
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "null");
    return {
      speedUnit: value?.speedUnit === "cpm" ? "cpm" : "wpm",
      showDecimals: typeof value?.showDecimals === "boolean" ? value.showDecimals : true,
      defaultTrendRange: value?.defaultTrendRange === "90" || value?.defaultTrendRange === "all" ? value.defaultTrendRange : "30"
    };
  } catch { return DEFAULT_PROFILE_DISPLAY_SETTINGS; }
}

export function writeProfileDisplaySettings(settings: ProfileDisplaySettings) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(settings));
}
