import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal dialog: focus moves in on open, returns to the opener on close, Escape closes, Tab is trapped. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => opener?.focus?.();
  }, []);
  return (
    <div className="p5-dialog-backdrop">
      <div
        ref={ref}
        className="p5-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          } else if (e.key === 'Tab' && ref.current) {
            const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Dialog with a required reason. `onConfirm` returns an error message to show, or null on success. */
export function ReasonDialog(props: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => string | null;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  return (
    <Dialog title={props.title} onClose={props.onCancel}>
      <div>{props.description}</div>
      <label>
        Reason (required)
        <textarea
          rows={3}
          value={reason}
          aria-invalid={error !== null}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
        />
      </label>
      {error && (
        <p id={errId} className="p5-reason" role="alert">
          {error}
        </p>
      )}
      <div className="p5-row">
        <button
          type="button"
          className="p5-btn p5-btn--primary"
          onClick={() => {
            if (!reason.trim()) {
              setError('A reason is required.');
              return;
            }
            setError(props.onConfirm(reason.trim()));
          }}
        >
          {props.confirmLabel}
        </button>
        <button type="button" className="p5-btn" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
