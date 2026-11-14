/** "Showing 1–5 of N" + Previous / page numbers / Next. Pure presentation; parent owns the page. */
export function Pager({ total, page, pageSize, onPage, label }: { total: number; page: number; pageSize: number; onPage: (page: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return <nav className="p1-pager" aria-label={label}>
    <p className="p1-pager__info">Showing {from}–{to} of {total}</p>
    <div className="p1-pager__buttons">
      <button type="button" className="p1-pager__step" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹ Previous</button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <button key={n} type="button" className="p1-pager__num" aria-current={n === page ? "page" : undefined} aria-label={`Page ${n}`} onClick={() => onPage(n)}>{n}</button>)}
      <button type="button" className="p1-pager__step" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next ›</button>
    </div>
  </nav>;
}

export const PAGE_SIZE = 5;
/** Page (1-based) that contains index, or 1. */
export const pageOf = (index: number) => (index < 0 ? 1 : Math.floor(index / PAGE_SIZE) + 1);
