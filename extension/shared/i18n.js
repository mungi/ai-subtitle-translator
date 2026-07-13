export function getMessage(key, substitutions) {
  const message = globalThis.chrome?.i18n?.getMessage?.(key, substitutions);
  return message || key;
}

export function getExtensionUiLanguage() {
  const locale = globalThis.chrome?.i18n?.getMessage?.("@@ui_locale")
    || globalThis.chrome?.i18n?.getUILanguage?.()
    || globalThis.navigator?.language
    || "en";
  if (/^ko/i.test(locale)) return "ko";
  if (/^ja/i.test(locale)) return "ja";
  return "en";
}
