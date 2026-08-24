import {
  ACCENT_COLOR_OPTIONS,
  APP_FONT_OPTIONS,
  DEFAULT_THEME_SETTINGS,
  THEME_PRESET_APPEARANCES,
  THEME_SETTINGS_STORAGE_KEY
} from "./app-storage";

const appearances = JSON.stringify(THEME_PRESET_APPEARANCES);
const accents = JSON.stringify(ACCENT_COLOR_OPTIONS.map(({ value }) => value));
const appFonts = JSON.stringify(APP_FONT_OPTIONS.map(({ value }) => value));
const defaults = JSON.stringify(DEFAULT_THEME_SETTINGS);

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var appearances=${appearances};var accents=${accents};var appFonts=${appFonts};var defaults=${defaults};var stored=JSON.parse(window.localStorage.getItem(${JSON.stringify(THEME_SETTINGS_STORAGE_KEY)})||"{}");var preset=stored.mode==="system"?"system":stored.themePreset==="system"||Object.prototype.hasOwnProperty.call(appearances,stored.themePreset)?stored.themePreset:defaults.themePreset;if(preset==="system"){preset=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"default-dark";}var root=document.documentElement;root.dataset.theme=appearances[preset]||appearances[defaults.themePreset];root.dataset.themePreset=preset;root.dataset.accent=accents.indexOf(stored.accentColor)>=0?stored.accentColor:defaults.accentColor;root.dataset.appFont=appFonts.indexOf(stored.appFont)>=0?stored.appFont:defaults.appFont;delete root.dataset.themeMode;}catch(error){}})();`;
