// Builds downloadable subtitle files (SRT with timing, TXT as plain readable text) from the
// cues shown on the player. Pure functions: no DOM and no extension APIs.
(() => {
  const NON_SPACE_LANGUAGE = /^(?:ja|zh|th|lo|km|my)(?:$|[-_])/i;
  const SENTENCE_END = /[.!?。！？…]["'”’」』)\]]*$/u;
  const PAUSE_BREAK_SECONDS = 2;
  const MAX_LINE_LENGTH = 200;
  // Pieces of one translated sentence shown across neighbouring cues are one entry in a file.
  const CONTINUATION_GAP_SECONDS = 1.2;

  function cueText(cue, kind) {
    const text = kind === "source" ? (cue?.sourceText ?? cue?.text) : (cue?.sourceText !== undefined ? cue.text : "");
    return String(text ?? "").replace(/\s+/g, " ").trim();
  }

  function pickCues(cues, kind) {
    if (!Array.isArray(cues)) return [];
    const picked = cues
      .map((cue) => ({ start: Number(cue?.start), end: Number(cue?.end), text: cueText(cue, kind), source: cueText(cue, "source") }))
      .filter((cue) => cue.text && Number.isFinite(cue.start) && Number.isFinite(cue.end));
    if (kind === "source") return picked;
    // A translated piece kept on screen over the next cue repeats there; the file holds it once,
    // over both cues' time. Two lines that only happen to read the same (two "Okay."s) stay apart.
    const merged = [];
    for (const cue of picked) {
      const previous = merged.at(-1);
      if (previous && previous.text === cue.text && previous.source !== cue.source
        && cue.start - previous.end <= CONTINUATION_GAP_SECONDS) {
        previous.end = Math.max(previous.end, cue.end);
        previous.source = cue.source;
        continue;
      }
      merged.push({ ...cue });
    }
    return merged;
  }

  // True when the cue list holds a translation worth downloading (at least one translated cue).
  function hasTranslation(cues) {
    return pickCues(cues, "translation").length > 0;
  }

  function formatSrtTime(seconds) {
    const total = Math.max(0, Math.round(seconds * 1000));
    const pad = (value, width) => String(value).padStart(width, "0");
    return `${pad(Math.floor(total / 3600000), 2)}:${pad(Math.floor(total / 60000) % 60, 2)}:${pad(Math.floor(total / 1000) % 60, 2)},${pad(total % 1000, 3)}`;
  }

  function buildSrt(cues, kind) {
    const picked = pickCues(cues, kind);
    return picked
      .map((cue, index) => {
        const end = cue.end > cue.start ? cue.end : cue.start + 0.5;
        return `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(end)}\n${cue.text}`;
      })
      .join("\n\n") + (picked.length ? "\n" : "");
  }

  // One paragraph line per sentence; a long pause or an over-long line also starts a new line.
  function buildTxt(cues, kind, { language = "" } = {}) {
    const separator = NON_SPACE_LANGUAGE.test(language) ? "" : " ";
    const lines = [];
    let current = "";
    let previousEnd = null;
    const flush = () => {
      if (current) lines.push(current);
      current = "";
    };
    for (const cue of pickCues(cues, kind)) {
      if (current && previousEnd !== null && cue.start - previousEnd >= PAUSE_BREAK_SECONDS) flush();
      current = current ? `${current}${separator}${cue.text}` : cue.text;
      previousEnd = cue.end;
      if (SENTENCE_END.test(cue.text) || current.length >= MAX_LINE_LENGTH) flush();
    }
    flush();
    return lines.length ? `${lines.join("\n")}\n` : "";
  }

  function sanitizeFileName(name) {
    const cleaned = String(name ?? "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 120)
      .trim();
    return cleaned || "subtitles";
  }

  globalThis.astSubtitleExport = { buildSrt, buildTxt, formatSrtTime, hasTranslation, sanitizeFileName };
})();
