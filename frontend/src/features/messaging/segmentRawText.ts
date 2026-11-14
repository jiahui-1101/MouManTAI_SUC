import type { EvidenceSpan } from "./mockMessageRuleExtractor";

/** Splits raw text into plain and evidence segments using exact offsets; overlapping spans are skipped. */
export function segmentRawText(rawText: string, spans: readonly EvidenceSpan[]) {
  const sorted = [...spans].filter((s) => rawText.slice(s.start, s.end) === s.text).sort((a, b) => a.start - b.start);
  const out: { text: string; span?: EvidenceSpan }[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue;
    if (span.start > cursor) out.push({ text: rawText.slice(cursor, span.start) });
    out.push({ text: rawText.slice(span.start, span.end), span });
    cursor = span.end;
  }
  if (cursor < rawText.length) out.push({ text: rawText.slice(cursor) });
  return out;
}
