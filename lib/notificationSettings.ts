export type NotificationSettings = { achievements: boolean; friendRequests: boolean; weeklySummary: boolean };
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { achievements: true, friendRequests: true, weeklySummary: false };
const KEY = "formaltype_notification_settings";
export function readNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  try { return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(window.localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULT_NOTIFICATION_SETTINGS; }
}
export function writeNotificationSettings(value: NotificationSettings) { if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(value)); }
