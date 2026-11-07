import { createSubtitleDocument, parseWebVtt } from "../shared/subtitles.js";

// Newer lessons serve captions from video.deeplearning.ai; older ones from a CloudFront distribution.
function isDeeplearningaiCaptionHost(hostname) {
  return hostname === "video.deeplearning.ai" || hostname.endsWith(".cloudfront.net");
}

export function isDeeplearningaiCaptionUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && isDeeplearningaiCaptionHost(url.hostname)
      && url.pathname.includes("/subtitle/")
      && url.pathname.endsWith(".vtt");
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "error",
    headers: { Accept: "text/vtt,text/plain,*/*" }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return text;
}

export async function fetchDeeplearningaiTranscript({ lessonId, trackUrl, sourceLanguage }) {
  if (!lessonId) throw new Error("DeepLearning.AI lessonId is required.");
  if (!isDeeplearningaiCaptionUrl(trackUrl)) throw new Error("DeepLearning.AI caption URL is invalid.");

  const cues = parseWebVtt(await fetchText(trackUrl), { idPrefix: "deeplearningai" });
  return createSubtitleDocument({
    platform: "deeplearningai",
    videoId: String(lessonId),
    sourceLanguage: String(sourceLanguage || "en"),
    cues
  });
}
