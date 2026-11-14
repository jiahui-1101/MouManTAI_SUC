import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

const DEFAULT_QUEUE_PCT = 68;
const MIN_PCT = 20;
const MAX_PCT = 80;
/** Queue | drag handle | detail. Width is a % of the layout. Drag, ←/→ (Shift = larger), Home or double-click resets. */
/** When `open` is false only the list is shown, full width; the list stays mounted so focus and paging survive opening the panel. */
export function SplitLayout({ children, label = "Resize review queue", open = true, initialQueuePct = DEFAULT_QUEUE_PCT, onMobileClose }: { children: [ReactNode, ReactNode]; label?: string; open?: boolean; initialQueuePct?: number; onMobileClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(initialQueuePct);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 640px)");
    const original = document.body.style.overflow;
    const update = () => { document.body.style.overflow = open && media.matches ? "hidden" : original; };
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); document.body.style.overflow = original; };
  }, [open]);
  const clamp = (v: number) => Math.round(Math.max(MIN_PCT, Math.min(MAX_PCT, v)));
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const move = (e: PointerEvent) => setPct(clamp(((e.clientX - box.left) / box.width) * 100));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.classList.remove("is-resizing"); };
    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const next = event.key === "ArrowLeft" ? pct - step : event.key === "ArrowRight" ? pct + step : event.key === "Home" ? initialQueuePct : null;
    if (next === null) return;
    event.preventDefault();
    setPct(clamp(next));
  };
  if (!open) return <div className="mi-layout mi-layout--queue" ref={ref}>{children[0]}</div>;
  return <div className="mi-layout mi-layout--open" ref={ref} onTouchStart={event => { const point = event.touches[0]; touch.current = point && !(event.target as HTMLElement).closest("input, select, textarea, [role=tablist]") ? { x: point.clientX, y: point.clientY } : null; }} onTouchEnd={event => { const point = event.changedTouches[0]; if (point && touch.current && window.matchMedia("(max-width: 640px)").matches) { const dx = point.clientX - touch.current.x; const dy = point.clientY - touch.current.y; if (dx > 90 && dx > Math.abs(dy) * 1.5) onMobileClose?.(); } touch.current = null; }} style={{ "--rq-pct": `${pct}fr`, "--detail-pct": `${100 - pct}fr` } as CSSProperties}>
    {children[0]}
    <div className="mi-resizer" role="separator" aria-orientation="vertical" aria-label={label} aria-valuenow={pct} aria-valuemin={MIN_PCT} aria-valuemax={MAX_PCT} aria-valuetext={`Queue ${pct}% of width`} tabIndex={0} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onDoubleClick={() => setPct(initialQueuePct)} title="Drag to resize · double-click to reset"><span /></div>
    {children[1]}
  </div>;
}
