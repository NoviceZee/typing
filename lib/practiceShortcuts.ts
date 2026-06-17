export type PracticeShortcutInput = {
  key: string;
  tabKey: boolean;
};

export function isRestartShortcut({ key, tabKey }: PracticeShortcutInput) {
  return key === "Enter" && tabKey;
}
