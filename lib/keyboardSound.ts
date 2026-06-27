export type KeyboardSoundSetting = "off" | "mechanical";
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
    label: "Sound off",
    description: "No keyboard sounds during practice."
  },
  {
    value: "mechanical",
    label: "Mechanical",
    description: "A short synthesized mechanical-style click."
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

      const profile = getSoundProfile(keyType);
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

function getSoundProfile(keyType: KeyboardSoundKeyType): KeyboardSoundProfile {
  switch (keyType) {
    case "space":
      return { frequency: 1050, durationSeconds: 0.032, volume: 0.02, type: "triangle" };
    case "enter":
      return { frequency: 720, durationSeconds: 0.038, volume: 0.024, type: "square" };
    case "backspace":
      return { frequency: 1320, durationSeconds: 0.028, volume: 0.018, type: "sawtooth" };
    case "normal":
    default:
      return { frequency: 1650, durationSeconds: 0.024, volume: 0.022, type: "square" };
  }
}
