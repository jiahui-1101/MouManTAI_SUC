import type { ReactNode } from 'react';
import { useP5Ui } from '../p5Store';

/**
 * Audit details (raw codes, IDs, fingerprints, versions). Collapsed by default and not rendered
 * at all in presentation mode; the same values remain in `title` tooltips where relevant.
 */
export function P5Details({ summary = 'Details', children, testId }: { summary?: string; children: ReactNode; testId?: string }) {
  const presentation = useP5Ui((s) => s.presentationMode);
  if (presentation) return null;
  return (
    <details className="p5-details" data-testid={testId ?? 'p5-details'}>
      <summary>{summary}</summary>
      <div className="p5-details__body p5-mono">{children}</div>
    </details>
  );
}
