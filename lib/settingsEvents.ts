export const LOCAL_ACCOUNT_SETTINGS_MUTATION_EVENT = "typing-station-local-account-settings-mutation";

export function dispatchLocalAccountSettingsMutation() {
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent !== "undefined"
  ) {
    window.dispatchEvent(new CustomEvent(LOCAL_ACCOUNT_SETTINGS_MUTATION_EVENT));
  }
}
