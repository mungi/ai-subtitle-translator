// Rebuilds caption cues into phrase-sized cues. Words keep their own timestamps: YouTube
// auto-generated captions carry real word offsets; other captions get estimates that stay
// inside their original cue, so highlighting never runs ahead of the source timing.
(() => {
  const NON_SPACE_LANGUAGE = /^(?:ja|zh|th|lo|km|my)(?:$|[-_])/i;
  const SENTENCE_END = /[.!?。！？…]["'”’」』)\]]*$/u;
  const CLAUSE_END = /[,;:，、；：]["'”’)\]]*$/u;
  const ABBREVIATION = /^(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e|u\.s|u\.k|inc|ltd|no|\d+)\.$/i;
  const BREAK_BEFORE = new Set([
    "and", "but", "so", "because", "which", "who", "where", "when", "while", "if", "or", "then",
    "although", "though", "since", "unless", "until", "however", "also", "now", "okay", "ok",
    "well", "actually", "basically", "um", "uh"
  ]);
  const WEAK_ENDING = new Set([
    "a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "from", "by", "about", "into",
    "and", "or", "but", "my", "your", "our", "their", "his", "her", "its", "this", "that", "these",
    "those", "is", "are", "was", "were", "be", "i", "we", "you", "they", "he", "she", "it", "can",
    "will", "would", "should", "could", "not", "very", "some", "any"
  ]);
  const LIMITS = {
    space: { max: 14, min: 3, softClause: 4, softBreak: 6, unit: (word) => 1 },
    nonSpace: { max: 26, min: 6, softClause: 8, softBreak: Infinity, unit: (word) => Array.from(word.text.trim()).length }
  };
  const MAX_DURATION = 6.5;
  const PAUSE = 0.9;
  const MERGE_GAP = 0.6;

  const normalizeWord = (text) => String(text || "").trim().toLowerCase().replace(/^["'“‘(\[]+|[^\p{L}\p{N}']+$/gu, "");

  // Time a word is likely spoken; used to read pauses from start-only word timings.
  function spokenSeconds(word) {
    return Math.min(0.6, 0.15 + 0.06 * Array.from(word.text.trim()).length);
  }

  function gapAfter(word, next) {
    return next.start - Math.min(word.end, word.start + spokenSeconds(word));
  }

  function isSentenceEnd(word) {
    const text = word.text.trim();
    return SENTENCE_END.test(text) && !ABBREVIATION.test(text);
  }

  function splitTokens(text, spaced) {
    if (spaced) return text.match(/\s*\S+/gu) || [];
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: "word" }).segment(text), (part) => part.segment);
    }
    return Array.from(text);
  }

  function estimateWords(cue, visibleEnd, spaced) {
    const tokens = splitTokens(cue.text, spaced).filter((token) => token.trim() || spaced);
    const weights = tokens.map((token) => Math.max(1, Array.from(token.trim()).length));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const span = Math.max(0.001, visibleEnd - cue.start);
    let consumed = 0;
    return tokens.map((text, index) => {
      const start = cue.start + span * consumed / total;
      consumed += weights[index];
      return { text, start, end: cue.start + span * consumed / total, originId: cue.id, estimated: true };
    }).filter((word) => word.text.trim());
  }

  // Flattens cues into one timed word list. Word ends never pass the next word's start.
  function collectWords(cues, spaced) {
    const words = [];
    cues.forEach((cue, index) => {
      const nextStart = cues.slice(index + 1).find((item) => item.start > cue.start)?.start;
      const visibleEnd = Math.min(cue.end, nextStart ?? cue.end);
      const cueWords = cue.words?.length
        ? cue.words.map((word) => ({ text: word.text, start: word.start, end: word.end, originId: cue.id }))
        : estimateWords(cue, visibleEnd, spaced);
      for (const word of cueWords) {
        if (!word.text.trim()) continue;
        // Overlapping cues must not drop text; a late word simply starts with the previous one.
        if (words.length && word.start < words.at(-1).start) word.start = words.at(-1).start;
        words.push({ ...word, text: words.length && spaced && !/^\s/.test(word.text) && word.originId !== words.at(-1).originId ? ` ${word.text}` : word.text });
      }
    });
    for (let index = 0; index < words.length - 1; index += 1) {
      words[index].end = Math.min(words[index].end, words[index + 1].start);
    }
    return words;
  }

  function speakingSeconds(words) {
    return words.at(-1).start + spokenSeconds(words.at(-1)) - words[0].start;
  }

  function measure(words, limits) {
    return words.reduce((sum, word) => sum + limits.unit(word), 0);
  }

  function splitScore(before, after, index, length, limits) {
    let score = Math.min(3, gapAfter(before, after) * 4);
    if (isSentenceEnd(before)) score += 6;
    else if (CLAUSE_END.test(before.text.trim())) score += 4;
    if (BREAK_BEFORE.has(normalizeWord(after.text))) score += 3;
    if (WEAK_ENDING.has(normalizeWord(before.text))) score -= 4;
    return score - Math.abs(index - length / 2) / length;
  }

  // Cuts an overlong phrase at its most natural point, keeping both sides at least `min` long.
  function splitOverlong(words, limits) {
    let best = -1;
    let bestScore = -Infinity;
    for (let index = 1; index < words.length; index += 1) {
      if (measure(words.slice(0, index), limits) < limits.min || measure(words.slice(index), limits) < 1) continue;
      const score = splitScore(words[index - 1], words[index], index, words.length, limits);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    }
    return best > 0 ? best : Math.max(1, words.length - 1);
  }

  function buildPhrases(words, limits) {
    const phrases = [];
    let current = [];
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const next = words[index + 1];
      current.push(word);
      while (current.length > 1 && (measure(current, limits) > limits.max
        || speakingSeconds(current) > MAX_DURATION)) {
        const cut = splitOverlong(current, limits);
        phrases.push(current.slice(0, cut));
        current = current.slice(cut);
      }
      if (!next) break;
      const size = measure(current, limits);
      const weak = WEAK_ENDING.has(normalizeWord(word.text));
      if (isSentenceEnd(word) || gapAfter(word, next) >= PAUSE
        || (!weak && size >= limits.softClause && CLAUSE_END.test(word.text.trim()))
        || (!weak && size >= limits.softBreak && BREAK_BEFORE.has(normalizeWord(next.text)))) {
        phrases.push(current);
        current = [];
      }
    }
    if (current.length) phrases.push(current);
    return mergeFragments(phrases, limits);
  }

  // Joins fragments that are too short to read, or that end on a word that needs what follows.
  function mergeFragments(phrases, limits) {
    const merged = [];
    for (const phrase of phrases) {
      const previous = merged.at(-1);
      if (previous) {
        const gap = gapAfter(previous.at(-1), phrase[0]);
        const fits = measure(previous, limits) + measure(phrase, limits) <= limits.max
          && speakingSeconds([...previous, ...phrase]) <= MAX_DURATION;
        const fragment = measure(phrase, limits) < limits.min || measure(previous, limits) < limits.min;
        const dangling = WEAK_ENDING.has(normalizeWord(previous.at(-1).text)) && !isSentenceEnd(previous.at(-1));
        if (fits && gap < MERGE_GAP && (dangling || (fragment && !isSentenceEnd(previous.at(-1))))) {
          previous.push(...phrase);
          continue;
        }
      }
      merged.push([...phrase]);
    }
    return merged;
  }

  function toCue(words, index, nextStart) {
    const first = words[0];
    const last = words.at(-1);
    // Keep the line up while it is read, but never past the next phrase or far into a silence.
    // Estimated words already end where their original cue ended, so only real timings are capped.
    const tail = last.estimated ? last.end : Math.min(last.end, last.start + 1.5);
    const end = Math.min(nextStart ?? Infinity, Math.max(tail, first.start + 1));
    const cueWords = words.map((word, wordIndex) => ({
      text: wordIndex === 0 ? word.text.trimStart() : word.text,
      start: word.start,
      end: wordIndex === words.length - 1 ? end : word.end,
      ...(word.estimated ? { estimated: true } : {})
    }));
    cueWords[cueWords.length - 1].text = cueWords.at(-1).text.trimEnd();
    return {
      id: `p${index}`,
      start: first.start,
      end: Math.max(end, first.start + 0.001),
      text: cueWords.map((word) => word.text).join("").replace(/\s+/g, " ").trim(),
      words: cueWords,
      originId: first.originId
    };
  }

  function segmentCues(cues, { language } = {}) {
    if (!Array.isArray(cues) || cues.length === 0) return cues;
    const spaced = !NON_SPACE_LANGUAGE.test(String(language || ""));
    const words = collectWords(cues, spaced);
    if (!words.length) return cues;
    const phrases = buildPhrases(words, spaced ? LIMITS.space : LIMITS.nonSpace);
    return phrases.map((phrase, index) => toCue(phrase, index, phrases[index + 1]?.[0].start));
  }

  globalThis.astPhraseSegmentation = { segmentCues };
})();
