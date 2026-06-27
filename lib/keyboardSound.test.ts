/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECORDED_KEYBOARD_SOUND_VERSION,
  RECORDED_SAMPLE_URLS,
  createKeyboardSoundPlayer
} from "./keyboardSound";

describe("keyboard recorded sound loading", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installAudioContextMock();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
      })
    );
  });

  it("preloads Recorded Mix with cache-busted key URLs only", async () => {
    const player = createKeyboardSoundPlayer();

    await player.preload("recorded");

    const requestedUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(requestedUrls).toContain(`/sounds/keyboard/recorded/key-1.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}`);
    expect(requestedUrls).toContain(`/sounds/keyboard/recorded/key-10.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}`);
    expect(requestedUrls.some((url) => url.includes("/space.wav"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/enter.wav"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/backspace.wav"))).toBe(false);
  });

  it("reloads recorded samples instead of reusing stale cached buffers", async () => {
    const player = createKeyboardSoundPlayer();

    await player.preload("recorded");
    await player.reload("recorded");

    const requestedUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.filter((url) => url.includes("/key-1.wav?"))).toHaveLength(2);
  });

  it("preloads individual recorded packs with only their matching key sample", async () => {
    const player = createKeyboardSoundPlayer();

    await player.preload("recorded-6");

    const requestedUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(requestedUrls).toContain(`/sounds/keyboard/recorded/key-6.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}`);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls.some((url) => url.includes("/key-7.wav?"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/key-8.wav?"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/space.wav"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/enter.wav"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/backspace.wav"))).toBe(false);
  });

  it("plays the correct single key sample for all key kinds in individual recorded packs", async () => {
    const audioMock = installAudioContextMock();
    const player = createKeyboardSoundPlayer();

    await player.preload("recorded-9");
    player.play("recorded-9", "normal", 0.5);
    player.play("recorded-9", "space", 0.5);
    player.play("recorded-9", "enter", 0.5);
    player.play("recorded-9", "backspace", 0.5);

    expect(audioMock.bufferSources.map((source) => source.buffer)).toEqual([
      { url: `/sounds/keyboard/recorded/key-9.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` },
      { url: `/sounds/keyboard/recorded/key-9.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` },
      { url: `/sounds/keyboard/recorded/key-9.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` },
      { url: `/sounds/keyboard/recorded/key-9.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` }
    ]);
  });

  it("keeps Recorded Mix using the full key-1 through key-10 pool for all key kinds", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    const audioMock = installAudioContextMock();
    const player = createKeyboardSoundPlayer();

    await player.preload("recorded");
    player.play("recorded", "normal", 0.5);
    player.play("recorded", "space", 0.5);
    player.play("recorded", "enter", 0.5);
    player.play("recorded", "backspace", 0.5);

    const requestedUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    for (const url of RECORDED_SAMPLE_URLS.normal) {
      expect(requestedUrls).toContain(`${url}?v=${RECORDED_KEYBOARD_SOUND_VERSION}`);
    }
    expect(requestedUrls).toHaveLength(10);
    expect(audioMock.bufferSources.map((source) => source.buffer)).toEqual([
      { url: `/sounds/keyboard/recorded/key-10.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` },
      { url: `/sounds/keyboard/recorded/key-10.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` },
      { url: `/sounds/keyboard/recorded/key-10.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` },
      { url: `/sounds/keyboard/recorded/key-10.wav?v=${RECORDED_KEYBOARD_SOUND_VERSION}` }
    ]);
  });
});

function installAudioContextMock() {
  const bufferSources: Array<{
    buffer: AudioBuffer | null;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }> = [];

  class AudioContextMock {
    currentTime = 1;
    destination = {};
    state = "running";
    resume = vi.fn().mockResolvedValue(undefined);
    decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => ({ url: (buffer as ArrayBuffer & { url?: string }).url }));
    createOscillator = vi.fn(() => ({
      frequency: { value: 0 },
      type: "square" as OscillatorType,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }));
    createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    }));
    createBufferSource = vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn()
      };
      bufferSources.push(source);
      return source;
    });
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: AudioContextMock
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      arrayBuffer: vi.fn(async () => Object.assign(new ArrayBuffer(8), { url }))
    }))
  );

  return { bufferSources };
}
