// Temporary, opt-in local diagnostics. Do not enable in production.
export function installTypingInputDebug(readState: () => {
  input: HTMLTextAreaElement | null;
  committedValue: string;
  renderedValue: string;
  status: string;
  activated: boolean;
  composing: boolean;
  awaitingCommit: boolean;
  generation: number;
}) {
  const entries: Record<string, unknown>[] = [];
  const nodes = new WeakMap<Node, number>();
  let nextNodeId = 0;
  let stopped = false;
  function nodeId(node: Node | null) {
    if (!node) return null;
    if (!nodes.has(node)) nodes.set(node, ++nextNodeId);
    return nodes.get(node);
  }
  function record(phase: string, event?: Event) {
    if (stopped) return;
    const { input, ...state } = readState();
    const native = event as (InputEvent & KeyboardEvent & CompositionEvent) | undefined;
    const entry = {
      sequence: entries.length ? Number(entries[entries.length - 1].sequence) + 1 : 1,
      time: performance.now(), phase, ...state,
      event: event?.type, key: native?.key, code: native?.code,
      inputType: native?.inputType, data: native?.data, isComposing: native?.isComposing,
      trusted: event?.isTrusted, prevented: event?.defaultPrevented,
      inputNode: nodeId(input), eventNode: nodeId(event?.target instanceof Node ? event.target : null),
      focusedNode: nodeId(document.activeElement), focused: document.activeElement === input,
      connected: input?.isConnected, domValue: input?.value, defaultValue: input?.defaultValue,
      selectionStart: input?.selectionStart, selectionEnd: input?.selectionEnd,
      selectionDirection: input?.selectionDirection
    };
    entries.push(entry);
    console.info("[Typing Station input debug]", JSON.stringify(entry));
    if (entries.length > 2_000) entries.shift();
  }
  const events = ["keydown", "keyup", "beforeinput", "input", "change", "compositionstart", "compositionupdate", "compositionend", "focusin", "focusout", "select", "selectionchange"];
  function relevant(event: Event) {
    const input = readState().input;
    return event.target === input ||
      (event.type === "selectionchange" && document.activeElement === input) ||
      (event instanceof KeyboardEvent && event.key === "Tab" &&
        (event.target === document.body || event.target === document.documentElement));
  }
  const capture = (event: Event) => {
    if (!relevant(event)) return;
    record("capture", event);
    queueMicrotask(() => record("microtask", event));
    requestAnimationFrame(() => record("animation-frame", event));
  };
  const bubble = (event: Event) => { if (relevant(event)) record("bubble", event); };
  events.forEach((name) => {
    window.addEventListener(name, capture, true);
    window.addEventListener(name, bubble);
  });
  const debug = { entries, mark: (label: string) => record(label), json: () => JSON.stringify(entries, null, 2) };
  const debugWindow = window as Window & { __typingInputDebug?: typeof debug };
  debugWindow.__typingInputDebug = debug;
  record("installed");
  return {
    record,
    stop() {
      stopped = true;
      events.forEach((name) => {
        window.removeEventListener(name, capture, true);
        window.removeEventListener(name, bubble);
      });
      if (debugWindow.__typingInputDebug === debug) delete debugWindow.__typingInputDebug;
    }
  };
}
