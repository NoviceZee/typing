import { safeSetStorageItem } from "./storageSafety";

export type KeyboardSoundSetting =
  | "off"
  | "mechanical"
  | "clicky"
  | "soft"
  | "typewriter"
  | "laptop"
  | "recorded"
  | "recorded-1"
  | "recorded-2"
  | "recorded-3"
  | "recorded-4"
  | "recorded-5"
  | "recorded-6"
  | "recorded-9"
  | "recorded-10";
export type KeyboardSoundKeyType = "normal" | "space" | "enter" | "backspace";

export const KEYBOARD_SOUND_STORAGE_KEY = "formaltype.keyboard_sound.v1";
export const KEYBOARD_SOUND_VOLUME_STORAGE_KEY = "formaltype.keyboard_sound_volume.v1";
export const DEFAULT_KEYBOARD_SOUND_VOLUME = 0.5;
export const RECORDED_KEYBOARD_SOUND_VERSION = "recorded-pack-1";

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
  },
  {
    value: "recorded",
    label: "Recorded Mix",
    description: "A random mix of the selected recorded keyboard samples."
  },
  {
    value: "recorded-1",
    label: "Tone Beep",
    description: "A single recorded tone-beep tap sample."
  },
  {
    value: "recorded-2",
    label: "Fast Typing",
    description: "A single recorded fast-typing tap sample."
  },
  {
    value: "recorded-3",
    label: "Quick Load",
    description: "A single recorded quick-load tap sample."
  },
  {
    value: "recorded-4",
    label: "Footstep Tap",
    description: "A single recorded footstep-style tap sample."
  },
  {
    value: "recorded-5",
    label: "Boiling Tap",
    description: "A single recorded boiling tap sample."
  },
  {
    value: "recorded-6",
    label: "Keyboard Tap",
    description: "A single recorded keyboard tap sample."
  },
  {
    value: "recorded-9",
    label: "iPhone Tap",
    description: "A single recorded iPhone tap sample."
  },
  {
    value: "recorded-10",
    label: "Computer Beep",
    description: "A single recorded computer beep sample."
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

type RecordedKeyboardSoundSetting = Extract<KeyboardSoundSetting, `recorded${string}`>;
type SynthKeyboardSoundPack = Exclude<KeyboardSoundSetting, "off" | RecordedKeyboardSoundSetting>;
type RecordedSampleState = "idle" | "loading" | "ready" | "failed";
type RecordedSampleCache = {
  state: RecordedSampleState;
  samples: Partial<Record<KeyboardSoundKeyType, AudioBuffer[]>>;
  loadId: number;
};

export const RECORDED_SAMPLE_URLS: Pick<Record<KeyboardSoundKeyType, string[]>, "normal"> = {
  normal: [
    "/sounds/keyboard/recorded/key-1.wav",
    "/sounds/keyboard/recorded/key-2.wav",
    "/sounds/keyboard/recorded/key-3.wav",
    "/sounds/keyboard/recorded/key-4.wav",
    "/sounds/keyboard/recorded/key-5.wav",
    "/sounds/keyboard/recorded/key-6.wav",
    "/sounds/keyboard/recorded/key-7.wav",
    "/sounds/keyboard/recorded/key-8.wav",
    "/sounds/keyboard/recorded/key-9.wav",
    "/sounds/keyboard/recorded/key-10.wav"
  ]
};

const RECORDED_INDIVIDUAL_NORMAL_SAMPLE_URLS: Partial<Record<RecordedKeyboardSoundSetting, string>> = {
  "recorded-1": "/sounds/keyboard/recorded/key-1.wav",
  "recorded-2": "/sounds/keyboard/recorded/key-2.wav",
  "recorded-3": "/sounds/keyboard/recorded/key-3.wav",
  "recorded-4": "/sounds/keyboard/recorded/key-4.wav",
  "recorded-5": "/sounds/keyboard/recorded/key-5.wav",
  "recorded-6": "/sounds/keyboard/recorded/key-6.wav",
  "recorded-9": "/sounds/keyboard/recorded/key-9.wav",
  "recorded-10": "/sounds/keyboard/recorded/key-10.wav"
};

const KEYBOARD_SOUND_PROFILES: Record<SynthKeyboardSoundPack, Record<KeyboardSoundKeyType, KeyboardSoundProfile>> = {
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
  safeSetStorageItem(KEYBOARD_SOUND_STORAGE_KEY, setting, { context: "writeKeyboardSoundSetting" });
}

export function readKeyboardSoundVolume(): number {
  if (typeof window === "undefined") {
    return DEFAULT_KEYBOARD_SOUND_VOLUME;
  }

  return normalizeKeyboardSoundVolume(window.localStorage.getItem(KEYBOARD_SOUND_VOLUME_STORAGE_KEY));
}

export function writeKeyboardSoundVolume(volume: number) {
  safeSetStorageItem(KEYBOARD_SOUND_VOLUME_STORAGE_KEY, String(normalizeKeyboardSoundVolume(volume)), {
    context: "writeKeyboardSoundVolume"
  });
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

export function isRecordedKeyboardSoundSetting(value: KeyboardSoundSetting): value is RecordedKeyboardSoundSetting {
  return value === "recorded" || value.startsWith("recorded-");
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
  const recordedSampleCaches = new Map<RecordedKeyboardSoundSetting, RecordedSampleCache>();

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

  async function preloadRecordedSamples(setting: RecordedKeyboardSoundSetting, { force = false }: { force?: boolean } = {}) {
    const context = getAudioContext();
    const cache = getRecordedSampleCache(setting);

    if (!context || typeof fetch !== "function" || typeof context.decodeAudioData !== "function") {
      cache.state = "failed";
      warnRecordedFallback("Recorded keyboard samples could not load because Web Audio decoding or fetch is unavailable.");
      return;
    }

    if (force) {
      cache.loadId += 1;
      cache.samples = {};
      cache.state = "idle";
    }

    if (cache.state === "loading" || cache.state === "ready") {
      return;
    }

    const loadId = cache.loadId;
    cache.state = "loading";

    try {
      const nextSamples: Partial<Record<KeyboardSoundKeyType, AudioBuffer[]>> = {};
      const sampleUrls = getRecordedSampleUrls(setting);

      await Promise.all(
        (Object.keys(sampleUrls) as Array<keyof typeof sampleUrls>).map(async (keyType) => {
          const buffers = await Promise.all(
            sampleUrls[keyType].map(async (url) => {
              const versionedUrl = getRecordedSampleUrl(url);
              const response = await fetch(versionedUrl);
              if (!response.ok) {
                throw new Error(`Recorded keyboard sample failed to load: ${versionedUrl}`);
              }
              return context.decodeAudioData(await response.arrayBuffer());
            })
          );
          nextSamples[keyType] = buffers;
        })
      );

      if (loadId !== cache.loadId) {
        return;
      }

      cache.samples = nextSamples;
      cache.state = "ready";
    } catch (error) {
      if (loadId !== cache.loadId) {
        return;
      }

      cache.samples = {};
      cache.state = "failed";
      warnRecordedFallback("Recorded keyboard samples failed to load. Falling back to synthesized Mechanical.", error);
    }
  }

  function playSynthesized(setting: KeyboardSoundSetting, keyType: KeyboardSoundKeyType, volumeScale: number) {
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

  function playRecorded(setting: RecordedKeyboardSoundSetting, keyType: KeyboardSoundKeyType, volumeScale: number) {
    const context = getAudioContext();
    const samplesByKeyType = getRecordedSampleCache(setting).samples;
    const samples = samplesByKeyType[keyType]?.length ? samplesByKeyType[keyType] : samplesByKeyType.normal;
    const sample = samples?.[Math.floor(Math.random() * samples.length)];

    if (!context || !sample || typeof context.createBufferSource !== "function") {
      playSynthesized("mechanical", keyType, volumeScale);
      return;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = sample;
    gain.gain.setValueAtTime(0.75 * normalizeKeyboardSoundVolume(volumeScale), now);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(now);
  }

  return {
    preload(setting: KeyboardSoundSetting) {
      if (isRecordedKeyboardSoundSetting(setting)) {
        return preloadRecordedSamples(setting);
      }
      return Promise.resolve();
    },
    reload(setting: KeyboardSoundSetting) {
      if (isRecordedKeyboardSoundSetting(setting)) {
        return preloadRecordedSamples(setting, { force: true });
      }
      return Promise.resolve();
    },
    play(setting: KeyboardSoundSetting, keyType: KeyboardSoundKeyType, volumeScale = DEFAULT_KEYBOARD_SOUND_VOLUME) {
      if (setting === "off") {
        return;
      }

      if (isRecordedKeyboardSoundSetting(setting)) {
        const cache = getRecordedSampleCache(setting);

        if (cache.state === "ready") {
          playRecorded(setting, keyType, volumeScale);
          return;
        }

        void preloadRecordedSamples(setting);
        if (cache.state === "failed") {
          warnRecordedFallback("Recorded keyboard samples are unavailable. Falling back to synthesized Mechanical.");
        }
        playSynthesized("mechanical", keyType, volumeScale);
        return;
      }

      playSynthesized(setting, keyType, volumeScale);
    }
  };

  function getRecordedSampleCache(setting: RecordedKeyboardSoundSetting) {
    const existingCache = recordedSampleCaches.get(setting);
    if (existingCache) {
      return existingCache;
    }

    const nextCache: RecordedSampleCache = {
      state: "idle",
      samples: {},
      loadId: 0
    };
    recordedSampleCaches.set(setting, nextCache);
    return nextCache;
  }
}

function getRecordedSampleUrls(setting: RecordedKeyboardSoundSetting): Pick<Record<KeyboardSoundKeyType, string[]>, "normal"> {
  if (setting === "recorded") {
    return RECORDED_SAMPLE_URLS;
  }

  const normalSampleUrl = RECORDED_INDIVIDUAL_NORMAL_SAMPLE_URLS[setting];
  return {
    normal: normalSampleUrl ? [normalSampleUrl] : RECORDED_SAMPLE_URLS.normal
  };
}

function getRecordedSampleUrl(url: string) {
  return `${url}?v=${RECORDED_KEYBOARD_SOUND_VERSION}`;
}

function warnRecordedFallback(message: string, error?: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(message, error ?? "");
  }
}

function getSoundProfile(setting: KeyboardSoundSetting, keyType: KeyboardSoundKeyType): KeyboardSoundProfile {
  if (setting === "off" || isRecordedKeyboardSoundSetting(setting)) {
    return KEYBOARD_SOUND_PROFILES.mechanical[keyType];
  }

  return KEYBOARD_SOUND_PROFILES[setting]?.[keyType] ?? KEYBOARD_SOUND_PROFILES.mechanical[keyType];
}
