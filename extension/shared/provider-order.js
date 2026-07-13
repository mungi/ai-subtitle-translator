export const PROVIDER_DISPLAY_ORDER = [
  "googleTranslate",
  "deepl",
  "google",
  "openai",
  "anthropic",
  "openrouter",
  "nvidiaNim",
  "local"
];

export const PROVIDER_TAB_SEPARATOR_AFTER_ID = "deepl";

export function getOrderedProviderIds(providers = {}) {
  const providerIds = Object.keys(providers);
  const orderedIds = PROVIDER_DISPLAY_ORDER.filter((id) => (
    Object.prototype.hasOwnProperty.call(providers, id)
  ));
  const extraIds = providerIds.filter((id) => !PROVIDER_DISPLAY_ORDER.includes(id));
  return [...orderedIds, ...extraIds];
}

export function getOrderedProviders(providers = {}) {
  return getOrderedProviderIds(providers)
    .map((id) => providers[id])
    .filter(Boolean);
}
