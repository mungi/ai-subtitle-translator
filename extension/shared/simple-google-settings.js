import { resolveSecretFieldValue } from "./secret-fields.js";

export const SIMPLE_GOOGLE_MODEL = "gemini-3.1-flash-lite";
export const SIMPLE_GOOGLE_GUIDE_LINKS = [
  { label: "Get API Key", url: "https://aistudio.google.com/api-keys" },
  { label: "YouTube 설정 가이드", url: "https://www.youtube.com/watch?v=PLACEHOLDER" }
];

function withoutGoogleTestSuccess(providerTestStatus = {}) {
  const { google, ...remaining } = providerTestStatus;
  return remaining;
}

export function stageSimpleGoogleApiKey(settings, visibleValue) {
  const google = settings.providers.google;
  return {
    ...settings,
    providers: {
      ...settings.providers,
      google: {
        ...google,
        apiKey: resolveSecretFieldValue(visibleValue, google.apiKey),
        model: SIMPLE_GOOGLE_MODEL
      }
    },
    providerTestStatus: withoutGoogleTestSuccess(settings.providerTestStatus)
  };
}

export function applySimpleGoogleTestResult(settings, ok) {
  const providerTestStatus = withoutGoogleTestSuccess(settings.providerTestStatus);
  if (!ok) return { ...settings, providerTestStatus };

  return {
    ...settings,
    activeProvider: "google",
    providerTestStatus: { ...providerTestStatus, google: "success" }
  };
}
