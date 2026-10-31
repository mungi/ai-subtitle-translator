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

export function distributeGroupTranslation(group, translation) {
  const text = String(translation).trim();
  const units = text.match(/\S+\s*/gu) || [];
  // If there are fewer readable units than cues, keep the short sentence visible
  // across its original cues rather than flashing isolated characters.
  if (units.length < group.members.length) return group.members.map((cue) => ({ id: cue.id, text }));
  const parts = units;
  const weights = group.members.map((cue, index) => {
    const visibleEnd = Math.min(cue.end, group.members[index + 1]?.start ?? cue.end);
    return Math.max(1, cue.text.length) * Math.sqrt(Math.max(0.1, visibleEnd - cue.start));
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let consumed = 0;
  let accumulated = 0;
  return group.members.map((cue, index) => {
    accumulated += weights[index];
    const remaining = group.members.length - index - 1;
    const end = index === group.members.length - 1 ? parts.length
      : Math.max(consumed + 1, Math.min(parts.length - remaining, Math.round(parts.length * accumulated / total)));
    const segment = parts.slice(consumed, end).join("").trim();
    consumed = end;
    return { id: cue.id, text: segment || text };
  });
}
