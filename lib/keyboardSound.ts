export type KeyboardSoundSetting = "off" | "mechanical" | "clicky" | "soft" | "typewriter" | "laptop";
export type KeyboardSoundKeyType = "normal" | "space" | "enter" | "backspace";

export const KEYBOARD_SOUND_STORAGE_KEY = "formaltype.keyboard_sound.v1";
export const KEYBOARD_SOUND_VOLUME_STORAGE_KEY = "formaltype.keyboard_sound_volume.v1";
export const DEFAULT_KEYBOARD_SOUND_VOLUME = 0.5;

export const KEYBOARD_SOUND_OPTIONS: Array<{
  value: KeyboardSoundSetting;
  label: string;
  description: string;
}> = [
  {
    value: "off",
    label: "Off",
    description: "No keyboard sounds during practice."
  },
  {
    value: "mechanical",
    label: "Mechanical",
    description: "A short synthesized mechanical-style click."
  },
  {
    value: "clicky",
    label: "Clicky",
    description: "A brighter, sharper click with a crisp top end."
  },
  {
    value: "soft",
    label: "Soft",
    description: "A quieter, rounded tap for low-distraction practice."
  },
  {
    value: "typewriter",
    label: "Typewriter",
    description: "A punchier tap inspired by classic type bars."
  },
  {
    value: "laptop",
    label: "Laptop",
    description: "A short, muted scissor-switch style tick."
  }
];

const KEYBOARD_SOUND_SETTINGS = KEYBOARD_SOUND_OPTIONS.map((option) => option.value);

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type KeyboardSoundProfile = {
  frequency: number;
  durationSeconds: number;
  volume: number;
  type: OscillatorType;
};

type KeyboardSoundPack = Exclude<KeyboardSoundSetting, "off">;

const KEYBOARD_SOUND_PROFILES: Record<KeyboardSoundPack, Record<KeyboardSoundKeyType, KeyboardSoundProfile>> = {
  mechanical: {
    normal: { frequency: 1650, durationSeconds: 0.024, volume: 0.022, type: "square" },
    space: { frequency: 1050, durationSeconds: 0.032, volume: 0.02, type: "triangle" },
    enter: { frequency: 720, durationSeconds: 0.038, volume: 0.024, type: "square" },
    backspace: { frequency: 1320, durationSeconds: 0.028, volume: 0.018, type: "sawtooth" }
  },
  clicky: {
    normal: { frequency: 2350, durationSeconds: 0.018, volume: 0.018, type: "square" },
    space: { frequency: 1780, durationSeconds: 0.024, volume: 0.017, type: "square" },
    enter: { frequency: 1280, durationSeconds: 0.031, volume: 0.021, type: "sawtooth" },
    backspace: { frequency: 2680, durationSeconds: 0.019, volume: 0.016, type: "square" }
  },
  soft: {
    normal: { frequency: 820, durationSeconds: 0.035, volume: 0.014, type: "triangle" },
    space: { frequency: 640, durationSeconds: 0.045, volume: 0.013, type: "sine" },
    enter: { frequency: 520, durationSeconds: 0.052, volume: 0.016, type: "triangle" },
    backspace: { frequency: 950, durationSeconds: 0.032, volume: 0.012, type: "sine" }
  },
  typewriter: {
    normal: { frequency: 1450, durationSeconds: 0.042, volume: 0.027, type: "sawtooth" },
    space: { frequency: 680, durationSeconds: 0.055, volume: 0.024, type: "square" },
    enter: { frequency: 420, durationSeconds: 0.07, volume: 0.03, type: "sawtooth" },
    backspace: { frequency: 1120, durationSeconds: 0.038, volume: 0.022, type: "square" }
  },
  laptop: {
    normal: { frequency: 1250, durationSeconds: 0.016, volume: 0.012, type: "triangle" },
    space: { frequency: 980, durationSeconds: 0.022, volume: 0.011, type: "triangle" },
    enter: { frequency: 760, durationSeconds: 0.026, volume: 0.014, type: "square" },
    backspace: { frequency: 1500, durationSeconds: 0.018, volume: 0.011, type: "triangle" }
  }
};

export function readKeyboardSoundSetting(): KeyboardSoundSetting {
  if (typeof window === "undefined") {
    return "off";
  }

  const stored = window.localStorage.getItem(KEYBOARD_SOUND_STORAGE_KEY);
  return isKeyboardSoundSetting(stored) ? stored : "off";
}

export function writeKeyboardSoundSetting(setting: KeyboardSoundSetting) {
  window.localStorage.setItem(KEYBOARD_SOUND_STORAGE_KEY, setting);
}

export function readKeyboardSoundVolume(): number {
  if (typeof window === "undefined") {
    return DEFAULT_KEYBOARD_SOUND_VOLUME;
  }

  return normalizeKeyboardSoundVolume(window.localStorage.getItem(KEYBOARD_SOUND_VOLUME_STORAGE_KEY));
}

export function writeKeyboardSoundVolume(volume: number) {
  window.localStorage.setItem(KEYBOARD_SOUND_VOLUME_STORAGE_KEY, String(normalizeKeyboardSoundVolume(volume)));
}

export function normalizeKeyboardSoundVolume(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_KEYBOARD_SOUND_VOLUME;
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_KEYBOARD_SOUND_VOLUME;
  }

  return Math.min(1, Math.max(0, numericValue));
}

export function isKeyboardSoundSetting(value: unknown): value is KeyboardSoundSetting {
  return typeof value === "string" && KEYBOARD_SOUND_SETTINGS.includes(value as KeyboardSoundSetting);
}

export function getKeyboardSoundKeyType(key: string): KeyboardSoundKeyType {
  if (key === " ") {
    return "space";
  }

  if (key === "Enter") {
    return "enter";
  }

  if (key === "Backspace") {
    return "backspace";
  }

  return "normal";
}

export function isTypingSoundKey(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  if (event.key.length === 1) {
    return true;
  }

  return event.key === "Enter" || event.key === "Backspace";
}

export function createKeyboardSoundPlayer() {
  let audioContext: AudioContext | null = null;

  function getAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextConstructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    audioContext ??= new AudioContextConstructor();
    return audioContext;
  }

  return {
    play(setting: KeyboardSoundSetting, keyType: KeyboardSoundKeyType, volumeScale = DEFAULT_KEYBOARD_SOUND_VOLUME) {
      if (setting === "off") {
        return;
      }

      const context = getAudioContext();
      if (!context) {
        return;
      }

      if (context.state === "suspended") {
        void context.resume();
      }

      const profile = getSoundProfile(setting, keyType);
      const now = context.currentTime;
      const pitchVariation = 0.94 + Math.random() * 0.12;
      const volumeVariation = 0.82 + Math.random() * 0.28;
      const accessibilityVolume =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0.65 : 1;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const volume = profile.volume * volumeVariation * accessibilityVolume * normalizeKeyboardSoundVolume(volumeScale);

      oscillator.type = profile.type;
      oscillator.frequency.value = profile.frequency * pitchVariation;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.durationSeconds);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + profile.durationSeconds);
    }
  };
}

function getSoundProfile(setting: KeyboardSoundSetting, keyType: KeyboardSoundKeyType): KeyboardSoundProfile {
  if (setting === "off") {
    return KEYBOARD_SOUND_PROFILES.mechanical[keyType];
  }

  return KEYBOARD_SOUND_PROFILES[setting]?.[keyType] ?? KEYBOARD_SOUND_PROFILES.mechanical[keyType];
}
