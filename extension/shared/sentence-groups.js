// Keep sentence membership and playback timing in the application, outside the LLM protocol.
export function buildSentenceGroups(cues) {
  const groups = [];
  let current = [];
  let chars = 0;
  const flush = () => {
    if (!current.length) return;
    groups.push({ id: String(groups.length), start: current[0].start, end: current.at(-1).end,
      text: current.map((cue) => cue.text).join(" "), members: current });
    current = [];
    chars = 0;
  };
  for (const cue of cues) {
    if (current.length && (cue.start - current.at(-1).end >= 1.2
      || cue.start - current[0].start >= 20 || chars + cue.text.length > 900)) flush();
    current.push(cue);
    chars += cue.text.length;
    if (/[.!?。！？]["'”’」』)\]]*\s*$/u.test(cue.text)) flush();
  }
  flush();
  return groups;
}

// A translated sentence is laid back over its original cues as readable pieces. The cue times and
// count never change; only where the text breaks does. A piece should end at a full stop or comma
// (or a Korean connective ending) rather than mid-phrase, should not be a word or two flashing by,
// and should not be far longer than one subtitle line can hold. A cue that cannot start a sensible
// piece keeps showing the piece before it, so the text stays up across both cues.
const SENTENCE_END_PATTERN = /[.!?…。！？]["'”’」』)\]]*$/u;
const CLAUSE_END_PATTERN = /[,;:、，；：—–]["'”’」』)\]]*$/u;
const KOREAN_CONNECTIVE_PATTERN = /(?:면서|으며|며|하고|는데|은데|지만|으면|면|니까|어서|아서|해서|도록|거나|든지|고)$/u;
const WIDE_CHAR_PATTERN = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯豈-﫿]/gu;
const CJK_PUNCTUATION_PIECE = /[^、。，！？；：]*[、。，！？；：]+["'”’」』)\]]*\s*|[^、。，！？；：]+\s*$/gu;

// Words, with text that has no spaces (Japanese, Chinese) also broken after its own punctuation.
function splitTranslationUnits(text) {
  const units = [];
  for (const word of text.match(/\S+\s*/gu) || []) {
    const pieces = word.match(CJK_PUNCTUATION_PIECE) || [];
    units.push(...(pieces.join("") === word ? pieces : [word]));
  }
  return units;
}

function visibleLength(value) {
  return value.replace(/\s+/gu, "").length;
}

function breakCost(unit) {
  const word = unit.trim();
  if (SENTENCE_END_PATTERN.test(word)) return 0;
  if (CLAUSE_END_PATTERN.test(word)) return 2;
  if (KOREAN_CONNECTIVE_PATTERN.test(word)) return 6;
  return 10;
}

export function distributeGroupTranslation(group, translation) {
  const text = String(translation).trim();
  const members = group.members;
  const units = splitTranslationUnits(text);
  if (members.length < 2 || units.length < 2) return members.map((cue) => ({ id: cue.id, text }));

  const totalChars = visibleLength(text);
  // Korean, Japanese and Chinese fit about half as many characters on a line as Latin script.
  const wide = (text.match(WIDE_CHAR_PATTERN) || []).length >= totalChars * 0.3;
  const minChars = wide ? 7 : 14;
  const maxChars = wide ? 40 : 80;
  const maxCharsPerSecond = wide ? 14 : 24;

  const prefixChars = [0];
  for (const unit of units) prefixChars.push(prefixChars.at(-1) + visibleLength(unit));
  const visibleEnds = members.map((cue, index) => Math.max(cue.start + 0.1, Math.min(cue.end, members[index + 1]?.start ?? cue.end)));
  // Where each cue starts, as a share of the sentence: source text length and time both count.
  const weights = members.map((cue, index) => Math.max(1, cue.text.length) * Math.sqrt(Math.max(0.1, visibleEnds[index] - cue.start)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const cueStartShare = [0];
  for (const weight of weights) cueStartShare.push(cueStartShare.at(-1) + weight / totalWeight);

  // Word order differs between languages, so the translation drifts from the source timing a little.
  const alignCost = (cueIndex, unitIndex) => 25 * Math.abs(prefixChars[unitIndex] / totalChars - cueStartShare[cueIndex]);
  // The piece units[from..to) shown on cues firstCue..nextCue-1.
  const pieceCost = (from, to, firstCue, nextCue) => {
    const chars = prefixChars[to] - prefixChars[from];
    const seconds = visibleEnds[nextCue - 1] - members[firstCue].start;
    let cost = to < units.length ? breakCost(units[to - 1]) : 0;
    if (chars < minChars && !(from === 0 && to === units.length)) cost += 12 + (minChars - chars);
    if (chars > maxChars) cost += (chars - maxChars) * 0.6;
    if (chars > maxCharsPerSecond * seconds) cost += (chars - maxCharsPerSecond * seconds) * 0.3;
    return cost + (nextCue - firstCue - 1) * 4;
  };

  // best[cue][unit]: cheapest layout so far in which a new piece starts at this cue with this unit.
  const n = members.length;
  const m = units.length;
  const best = Array.from({ length: n }, () => new Array(m).fill(Infinity));
  const from = Array.from({ length: n }, () => new Array(m).fill(null));
  best[0][0] = 0;
  for (let cue = 1; cue < n; cue += 1) {
    for (let unit = 1; unit < m; unit += 1) {
      const align = alignCost(cue, unit);
      for (let prevCue = 0; prevCue < cue; prevCue += 1) {
        for (let prevUnit = 0; prevUnit < unit; prevUnit += 1) {
          if (best[prevCue][prevUnit] === Infinity) continue;
          const cost = best[prevCue][prevUnit] + pieceCost(prevUnit, unit, prevCue, cue) + align;
          if (cost < best[cue][unit]) {
            best[cue][unit] = cost;
            from[cue][unit] = [prevCue, prevUnit];
          }
        }
      }
    }
  }
  let end = null;
  let endCost = Infinity;
  for (let cue = 0; cue < n; cue += 1) {
    for (let unit = 0; unit < m; unit += 1) {
      if (best[cue][unit] === Infinity) continue;
      const cost = best[cue][unit] + pieceCost(unit, m, cue, n);
      if (cost < endCost) {
        endCost = cost;
        end = [cue, unit];
      }
    }
  }

  const starts = [];
  for (let step = end; step; step = from[step[0]][step[1]]) starts.unshift(step);
  const texts = new Array(n);
  starts.forEach(([cue, unit], index) => {
    const [nextCue, nextUnit] = starts[index + 1] || [n, m];
    const piece = units.slice(unit, nextUnit).join("").trim();
    for (let shown = cue; shown < nextCue; shown += 1) texts[shown] = piece;
  });
  return members.map((cue, index) => ({ id: cue.id, text: texts[index] || text }));
}
