import { getOrderedProviders } from "./provider-order.js";
import { sanitizeProviderErrorMessage } from "./provider-error-sanitizer.js";

export function getConfiguredKeyProviders(settings = {}) {
  return getOrderedProviders(settings.providers || {})
    .filter((provider) => String(provider.apiKey || "").trim());
}

export async function validateConfiguredProviderKeys(settings, { testProvider, onProgress } = {}) {
  if (typeof testProvider !== "function") {
    throw new Error("testProvider callback is required.");
  }

  const providers = getConfiguredKeyProviders(settings);
  const providerTestStatus = { ...(settings?.providerTestStatus || {}) };
  const results = [];
  let successCount = 0;

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    delete providerTestStatus[provider.id];
    onProgress?.({ provider, current: index + 1, total: providers.length });
    try {
      const response = await testProvider(provider.id);
      if (response?.ok) {
        providerTestStatus[provider.id] = "success";
        successCount += 1;
        results.push({
          providerId: provider.id,
          providerLabel: provider.label || provider.id,
          ok: true
        });
      } else {
        results.push({
          providerId: provider.id,
          providerLabel: provider.label || provider.id,
          ok: false,
          error: sanitizeProviderErrorMessage(response?.error, provider)
        });
      }
    } catch (error) {
      results.push({
        providerId: provider.id,
        providerLabel: provider.label || provider.id,
        ok: false,
        error: sanitizeProviderErrorMessage(error?.message, provider)
      });
    }
  }

  return {
    providerTestStatus,
    total: providers.length,
    successCount,
    failedCount: providers.length - successCount,
    results
  };
}
