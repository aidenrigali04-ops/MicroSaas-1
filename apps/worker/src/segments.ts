export type WhisperWord = { word: string; start: number; end: number };
export type WhisperSeg = {
  id?: number;
  start: number;
  end: number;
  text: string;
};

export type CandidateWindow = {
  startSec: number;
  endSec: number;
  label: string;
  transcriptSnippet: string;
};

/** Build ~12–55s candidate windows from Whisper segments. */
export function buildCandidates(
  segments: WhisperSeg[],
  durationSec: number,
): CandidateWindow[] {
  if (!segments.length) {
    return [];
  }
  const windows: CandidateWindow[] = [];
  let i = 0;
  while (i < segments.length) {
    const start = segments[i]!.start;
    let end = segments[i]!.end;
    let text = segments[i]!.text.trim();
    let j = i;
    while (j + 1 < segments.length && end - start < 14) {
      j++;
      end = segments[j]!.end;
      text = `${text} ${segments[j]!.text.trim()}`.trim();
    }
    while (j + 1 < segments.length && end - start < 48) {
      const nend = segments[j + 1]!.end;
      if (nend - start > 56) {
        break;
      }
      j++;
      end = nend;
      text = `${text} ${segments[j]!.text.trim()}`.trim();
    }
    const dur = Math.min(durationSec, end) - Math.max(0, start);
    if (dur >= 8) {
      const snippet = text;
      const label = snippet.length > 72 ? `${snippet.slice(0, 69)}…` : snippet;
      windows.push({
        startSec: Math.max(0, start),
        endSec: Math.min(durationSec, end),
        label,
        transcriptSnippet: snippet,
      });
    }
    j++;
    i = j;
  }

  const scored = windows.map((w) => ({
    w,
    score: scoreWindowText(w.transcriptSnippet, w.endSec - w.startSec),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((s) => s.w);
}

export function scoreWindowText(text: string, durationSec: number): number {
  let s = 0;
  const lower = text.toLowerCase();
  if (/\?/.test(text)) {
    s += 3;
  }
  if (/!/.test(text)) {
    s += 1;
  }
  if (
    /\b(why|how|what|secret|mistake|truth|stop|never|always)\b/i.test(lower)
  ) {
    s += 2;
  }
  const wc = text.split(/\s+/).filter(Boolean).length;
  const wps = wc / Math.max(durationSec, 1);
  if (wps >= 2 && wps <= 4.5) {
    s += 2;
  }
  if (durationSec >= 18 && durationSec <= 45) {
    s += 2;
  }
  return s;
}

export type ScoreResult = {
  potentialScore: number;
  scoreReasons: string[];
};

export function explainScore(
  text: string,
  durationSec: number,
): ScoreResult {
  const reasons: string[] = [];
  let raw = 40;
  const lower = text.toLowerCase();
  if (/\?/.test(text)) {
    raw += 12;
    reasons.push("Contains a question (often boosts retention).");
  }
  if (/\b(how|why|what)\b/i.test(lower)) {
    raw += 8;
    reasons.push("Opens with curiosity framing.");
  }
  const wc = text.split(/\s+/).filter(Boolean).length;
  const wps = wc / Math.max(durationSec, 1);
  if (wps >= 2 && wps <= 4.5) {
    raw += 10;
    reasons.push("Pacing is in a readable speech range.");
  } else if (wps < 1.2) {
    raw -= 8;
    reasons.push("Segment is sparse; may feel slow for short-form.");
  }
  if (durationSec >= 15 && durationSec <= 50) {
    raw += 10;
    reasons.push("Length fits many short-form placements.");
  }
  if (text.length > 280) {
    raw -= 5;
    reasons.push("Transcript block is long; tighter edit may help.");
  }
  const potentialScore = Math.max(0, Math.min(100, Math.round(raw)));
  if (reasons.length === 0) {
    reasons.push("Baseline fit from length and density.");
  }
  return { potentialScore, scoreReasons: reasons };
}

export function buildSrtFromSegments(
  segs: WhisperSeg[],
  windowStart: number,
  windowEnd: number,
): string {
  const toTs = (t: number) => {
    const ms = Math.max(0, t * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mm = ms % 1000;
    const pad = (n: number, w: number) => String(n).padStart(w, "0");
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(mm, 3)}`;
  };
  const slice = segs.filter(
    (seg) => seg.end > windowStart && seg.start < windowEnd,
  );
  let idx = 1;
  let body = "";
  for (const seg of slice) {
    const rs = Math.max(0, seg.start - windowStart);
    const re = Math.min(windowEnd - windowStart, seg.end - windowStart);
    if (re <= rs) {
      continue;
    }
    body += `${idx++}\n${toTs(rs)} --> ${toTs(re)}\n${seg.text.trim()}\n\n`;
  }
  if (body.length > 0) {
    return body;
  }
  return buildSrtForWindow(undefined, windowStart, windowEnd);
}

export function buildSrtForWindow(
  words: WhisperWord[] | undefined,
  windowStart: number,
  windowEnd: number,
): string {
  const toTs = (t: number) => {
    const ms = Math.max(0, t * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mm = ms % 1000;
    const pad = (n: number, w: number) => String(n).padStart(w, "0");
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(mm, 3)}`;
  };

  if (words && words.length > 0) {
    const slice = words.filter(
      (w) => w.end > windowStart && w.start < windowEnd,
    );
    let idx = 1;
    let body = "";
    for (const w of slice) {
      const rs = Math.max(0, w.start - windowStart);
      const re = Math.min(windowEnd - windowStart, w.end - windowStart);
      if (re <= rs) {
        continue;
      }
      body += `${idx++}\n${toTs(rs)} --> ${toTs(re)}\n${w.word.trim()}\n\n`;
    }
    if (body.length > 0) {
      return body;
    }
  }
  return `1\n${toTs(0)} --> ${toTs(windowEnd - windowStart)}\n(segment)\n\n`;
}
