export function normalizeCue({ id, start, end, text }) {
  const normalizedStart = Number(start);
  const normalizedEnd = Number(end);
  const normalizedText = String(text ?? "").replace(/\s+/g, " ").trim();

  return {
    id: String(id),
    start: normalizedStart,
    end: normalizedEnd,
    text: normalizedText
  };
}

export function createSubtitleDocument({ platform, videoId, sourceLanguage, cues }) {
  return {
    platform,
    videoId,
    sourceLanguage,
    cues: cues.map(normalizeCue)
  };
}

export function validateCues(cues) {
  if (!Array.isArray(cues)) {
    return { ok: false, error: "Cues must be an array." };
  }

  if (cues.length === 0) {
    return { ok: false, error: "Cues must not be empty." };
  }

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    if (!cue.id) {
      return { ok: false, error: `Cue ${index} is missing id.` };
    }

    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end)) {
      return { ok: false, error: `Cue ${cue.id} has invalid time values.` };
    }

    if (cue.start >= cue.end) {
      return { ok: false, error: `Cue ${cue.id} start must be before end.` };
    }

    if (index > 0 && cue.start < cues[index - 1].start) {
      return { ok: false, error: `Cue ${cue.id} is out of order.` };
    }
  }

  return { ok: true };
}

const ENTITY_MAP = {
  amp: "&",
  nbsp: " ",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  lsquo: "'",
  rsquo: "'",
  ldquo: "\"",
  rdquo: "\"",
  laquo: "<<",
  raquo: ">>"
};

export function decodeXmlEntities(value) {
  return String(value ?? "").replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (entity, name) => {
    const key = String(name).toLowerCase();
    if (ENTITY_MAP[key]) {
      return ENTITY_MAP[key];
    }

    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    return entity;
  });
}

export function stripCueMarkup(value) {
  return decodeXmlEntities(String(value ?? ""))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVttTimestamp(value) {
  const match = String(value ?? "").trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);

  if ([hours, minutes, seconds, millis].some((part) => !Number.isFinite(part))) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

export function parseWebVtt(vtt, { idPrefix = "vtt" } = {}) {
  const lines = String(vtt ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const cues = [];
  let index = 0;

  while (index < lines.length) {
    let line = lines[index].trim();

    if (!line || line === "WEBVTT") {
      index += 1;
      continue;
    }

    if (line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) {
      index += 1;
      while (index < lines.length && lines[index].trim() !== "") {
        index += 1;
      }
      continue;
    }

    let cueId = "";
    if (!line.includes("-->")) {
      cueId = line;
      index += 1;
      line = (lines[index] || "").trim();
    }

    if (!line.includes("-->")) {
      index += 1;
      continue;
    }

    const [rawStart, rawEnd] = line.split("-->");
    const start = parseVttTimestamp(rawStart);
    const end = parseVttTimestamp(rawEnd.trim().split(/\s+/)[0]);
    index += 1;

    const textLines = [];
    while (index < lines.length && lines[index].trim() !== "") {
      textLines.push(lines[index]);
      index += 1;
    }

    const text = stripCueMarkup(textLines.join(" "));
    if (start !== null && end !== null && text) {
      cues.push(normalizeCue({
        id: cueId || `${idPrefix}-${cues.length}`,
        start,
        end,
        text
      }));
    }
  }

  const validation = validateCues(cues);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return cues;
}
