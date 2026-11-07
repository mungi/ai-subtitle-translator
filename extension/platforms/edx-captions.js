import { createSubtitleDocument, parseWebVtt } from "../shared/subtitles.js";
import { genericCaptionInternals } from "./generic-captions.js";

// edX video blocks serve transcripts as "SJSON": { start: [ms], end: [ms], text: [] }.
// The page fetches it with the learner's session (the handler URL needs the edX cookies), and the
// worker turns it into cues so zero-length and reversed lines are repaired like every other source.
export const EDX_TRANSCRIPT_MAX_CUES = 20000;

export function edxSjsonToCues(sjson) {
  const starts = Array.isArray(sjson?.start) ? sjson.start : [];
  const ends = Array.isArray(sjson?.end) ? sjson.end : [];
  const texts = Array.isArray(sjson?.text) ? sjson.text : [];
  const count = Math.min(starts.length, ends.length, texts.length, EDX_TRANSCRIPT_MAX_CUES);
  const cues = [];
  for (let index = 0; index < count; index += 1) {
    const start = Number(starts[index]) / 1000;
    const end = Number(ends[index]) / 1000;
    const text = String(texts[index] ?? "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || !text) continue;
    cues.push({ id: `edx-${index}`, start, end, text });
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues;
}

export function buildEdxTranscript({ videoId, sourceLanguage, sjson }) {
  if (!videoId) throw new Error("edX videoId is required.");
  const cues = edxSjsonToCues(sjson);
  if (cues.length === 0) throw new Error("No edX captions are available for this video.");
  return createSubtitleDocument({
    platform: "edx",
    videoId: String(videoId),
    sourceLanguage: String(sourceLanguage || "en"),
    cues: parseWebVtt(genericCaptionInternals.cuesToVtt(cues), { idPrefix: "edx" })
  });
}
