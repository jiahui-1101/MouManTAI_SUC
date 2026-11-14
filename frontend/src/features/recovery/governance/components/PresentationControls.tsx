import { useEffect } from 'react';
import { CHECKPOINTS, runCheckpoint } from '../demoCheckpoints';
import { useP5Runtime, useP5Ui } from '../p5Store';
import { Dialog } from './Dialog';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

/**
 * Global P5 shortcuts. Mounted once per page by the workflow header.
 * Shift+P toggles presentation mode, "?" opens the shortcut list, Shift+1…6 jump to demo checkpoints.
 */
export function usePresentationShortcuts(onMessage?: (m: string) => void) {
  const runtime = useP5Runtime();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const ui = runtime.ui.getState();
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        ui.togglePresentationMode();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        ui.setShortcutsOpen(!ui.shortcutsOpen);
        return;
      }
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (e.shiftKey && digit) {
        const cp = CHECKPOINTS[Number(digit[1]) - 1];
        if (!cp) return;
        e.preventDefault();
        const res = runCheckpoint(cp.id, runtime);
        onMessage?.(res.ok ? res.value.statusLine : `Could not reach “${cp.label}”: ${res.detail}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runtime, onMessage]);
}

export function PresentationToggle() {
  const on = useP5Ui((s) => s.presentationMode);
  const toggle = useP5Ui((s) => s.togglePresentationMode);
  return (
    <button
      type="button"
      className={`p5-present-toggle ${on ? 'p5-present-toggle--on' : ''}`}
      aria-pressed={on}
      onClick={toggle}
      title={`Presentation mode ${on ? 'ON' : 'OFF'} — hides dev controls and audit details (Shift+P)`}
      aria-label="Presentation mode"
      data-testid="p5-presentation-toggle"
    >
      {on ? '● Presenting' : 'Present'}
    </button>
  );
}

export function ShortcutsDialog() {
  const open = useP5Ui((s) => s.shortcutsOpen);
  const setOpen = useP5Ui((s) => s.setShortcutsOpen);
  if (!open) return null;
  return (
    <Dialog title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <ul className="p5-shortcuts" data-testid="p5-shortcuts-list">
        <li>
          <kbd>Shift</kbd>+<kbd>P</kbd> Toggle presentation mode
        </li>
        <li>
          <kbd>?</kbd> Show / hide this list
        </li>
        {CHECKPOINTS.map((cp, i) => (
          <li key={cp.id}>
            <kbd>Shift</kbd>+<kbd>{i + 1}</kbd> Jump to demo state: {cp.label}
          </li>
        ))}
      </ul>
      <p className="p5-muted">Demo states reset P5 and replay real approvals and tasks. Refresh-safe persistence is TODO(G0).</p>
      <div className="p5-row">
        <button type="button" className="p5-btn" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
