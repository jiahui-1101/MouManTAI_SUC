# MouManTAI Recovery+ Design System & Visual Specification

This document is the authoritative design system reference for **MouManTAI Recovery+** (FeedMe Portal Concept Integration for the Happy Potato demo outlet). All frontend modules (P1–P5) and shared components must adhere to the design tokens, visual hierarchy, and accessibility rules documented below.

---

## 1. Theme Overview & Core Principles

1. **Light Mode Only**: The interface is strictly light-mode (`color-scheme: light`). Dark-mode media queries (`@media (prefers-color-scheme: dark)`) are prohibited.
2. **Tripartite Color Separation**:
   - **Brand Accent & Navigation**: FeedMe-inspired orange palette used for application branding, navigation active states, and user actions.
   - **Operational Status**: Standard operational signals (green, amber, red, blue, grey) completely independent of brand colors.
   - **Truth & Data Provenance**: Explicit visual markers distinguishing physical verified inventory from simulated calculations, supplier claims, and live channels.
3. **Information Accessibility (WCAG AA)**:
   - Status is **never conveyed by color alone**; it is always accompanied by readable text.
   - Minimum contrast ratio of **4.5:1** for body text and **3:1** for large text or interactive controls.

---

## 2. Color Palette & Token Reference

All colors are defined as CSS custom properties in `frontend/src/styles/tokens.css` and scoped under `:root`.

### 2.1 Brand & Action Tokens

| Token | Value | Contrast on White | Usage & Semantics |
| :--- | :--- | :--- | :--- |
| `--brand-primary` | `#ff7823` | 2.58:1 (non-text) | FeedMe orange decorative accent, brand highlights (not for text or physical stock) |
| `--action-primary` | `#ad4808` | **5.66:1** (AA) | Primary action button background (`.fm-btn--primary`), interactive focus points |
| `--action-primary-hover`| `#8c3806` | **7.83:1** (AAA)| Hover / active state for primary action buttons |
| `--brand-primary-soft` | `#fff2e8` | — | Subtle orange tint; active navigation background (`--nav-active-bg`), hero accents |
| `--brand-primary-text` | `#a54508` | **5.53:1** (AA) | Text links, active tab indicators, brand typography accents |

### 2.2 Surface & Canvas Tokens

| Token | Value | Description |
| :--- | :--- | :--- |
| `--page-background` | `#f7f8fa` | Default page background canvas |
| `--surface-primary` | `#ffffff` | Primary surface for panels (`.fm-panel`), cards, tables, and dialogs |
| `--surface-secondary`| `#f4f5f7` | Secondary surface: table headers, chip backgrounds, secondary buttons, KPI cards |
| `--surface-hover` | `#f2f4f7` | Hover state for table rows, navigation links, and list items |

### 2.3 Text, Border & Focus Tokens

| Token | Value | Contrast / Role |
| :--- | :--- | :--- |
| `--text-primary` | `#252932` | Primary body copy, headings, and high-emphasis typography (**14.6:1**) |
| `--text-secondary` | `#667085` | Secondary text, captions, metadata, table column headers (**4.7:1**) |
| `--text-on-brand` | `#ffffff` | Text on primary brand and danger action buttons |
| `--border-default` | `#e6e8eb` | Default boundary line for panels, cards, dividers, and inputs |
| `--border-strong` | `#d0d5dd` | Interactive borders: active form controls, hover borders for ghost buttons |
| `--focus-color` | `#943a04` | Solid 2px outline for accessible keyboard navigation (**7.33:1**) |

### 2.4 Semantic Operational Status Tokens

Status colors are decoupled from the brand orange and always pair a color tint with human-readable text.

| Status | Solid Token (`--status-*`) | Soft Token (`--status-*-soft`) | Badge Class (`.fm-badge--*`) | Meaning & Context |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#11724e` | `#e7f5ef` | `.fm-badge--success` | Feasible plan, verified receipt, protected order, healthy node |
| **Warning** | `#8b500d` | `#fdf1e1` | `.fm-badge--warning` | Conditional feasibility, pending verification, delivery delay, at-risk portion |
| **Danger** | `#b42318` | `#fdecea` | `.fm-badge--danger` | Infeasible plan, delivery cancellation, quality rejection, stock shortage |
| **Info** | `#1d55c3` | `#eaf1fe` | `.fm-badge--info` | Operational guidance, schedule timeline, informative alerts |
| **Neutral** | `#667085` | `#f2f4f7` | `.fm-badge--neutral` | Inactive, draft state, baseline reference, uninspected |
| **Count** | `#667085` | `#f4f5f7` | `.fm-badge--count` | Numerical tally, portion count, batch index |

### 2.5 Truth, Data Provenance & Visualization Tokens

| Category | Token / Class | Value | Visual Treatment & Rules |
| :--- | :--- | :--- | :--- |
| **Simulated / Synthetic** | `--status-simulated`<br>`--status-simulated-soft` | `#6941c6`<br>`#f2edfc` | Purple tint used for simulated calculations, mock data, and unexecuted actions |
| **Live Channel Provenance** | `--p2-live` (in `p2.css`) | `#0e7c86` | Deep teal outline (`.p2-badge--live`) for verified WhatsApp / Outlook / Telegram messages |
| **Physical Inventory Stock** | `--viz-physical` | `#475467` | **Slate grey**. NEVER use brand orange to depict physical on-hand inventory! |
| **Planned / Incoming Supply** | `.pa-coverage-conditional`<br>`.p2-hbar__fill--incoming` | Patterned gradient | Striped diagonal pattern (`repeating-linear-gradient(135deg, var(--status-info-soft) 0 4px, var(--status-info) 4px 8px)`) |
| **Demand / Cutoff Line** | `.pa-coverage-marker`<br>`.p4-deadline` | Dashed border | 2px dashed border (`var(--text-primary)` or `#b87a29`) |

### 2.6 Backward Compatibility Aliases

The following legacy aliases in `tokens.css` map directly to the modern tokens:

```css
--ink:        var(--text-primary);        /* #252932 */
--ink-2:      var(--text-secondary);      /* #667085 */
--paper:      var(--page-background);     /* #f7f8fa */
--surface:    var(--surface-primary);     /* #ffffff */
--line:       var(--border-default);      /* #e6e8eb */
--brand:      var(--brand-primary-text);  /* #a54508 */
--brand-soft: var(--brand-primary-soft);  /* #fff2e8 */
```

---

## 3. Typography, Radii, Spacing & Elevation

### 3.1 Typography Stack & Hierarchy

- **UI & Headings**: `var(--font-ui): "Inter", system-ui, -apple-system, "Segoe UI", sans-serif`
- **Monospace & Tabular Data**: `var(--font-mono): "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`
- Numbers, monetary values, weights, and timestamps use `font-variant-numeric: tabular-nums;`.

| Level | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title (`h1`)** | `22px` | `700` | `1.3` | `-0.01em` | `.page__title` inside `PageContainer` |
| **Workspace Title** | `20px` | `700` | `1.35` | Normal | Large workspace headings (`.pa-workspace-title`) |
| **Dialog / Panel Title**| `17px` / `16px` | `700` | `1.3` | Normal | Modal headers (`.fm-dialog__title`), card titles |
| **Section Header (`h2`)**| `15px` | `700` | `1.4` | Normal | `.fm-section-header__title`, sub-sections |
| **Subsection Header (`h3`)**| `14px` | `600` | `1.4` | Normal | Panel sub-headings, filter titles |
| **Standard Body** | `14px` / `13.5px` | `400` / `500` | `1.5` | Normal | Default prose, table cell copy, forms |
| **Table Headings / Meta**| `12.5px` | `600` | `1.4` | Normal | Table `th`, muted metadata (`.p5-muted`, `.p2-muted`) |
| **Badges & Pills** | `11.5px` | `600` | `18px` | Normal | Status indicators, micro-tags |
| **Eyebrow / Kicker** | `11px` | `600` / `750` | `1.2` | `+0.05em` | All-caps section kickers (`.pa-kicker`, `.p4-kicker`) |
| **Monospace / Code** | `11.5px`–`12px` | `400` / `500` | `1.65` | Normal | IDs (`HP-SC-A-001`, `HP-SNAP-001`), fingerprints |

### 3.2 Border Radii

- `--radius-sm: 6px`: Compact chips, badges, timeline markers, sub-buttons.
- `--radius-md: 8px`: Form inputs (`.fm-input`, `.fm-select`), standard buttons (`.fm-btn`), tabs.
- `--radius-lg: 10px`: Panels (`.fm-panel`), cards, alert banners (`.fm-banner`), table wrappers.
- **Dialogs**: `12px` (`.fm-dialog`).
- **Pills / Status Badges**: `999px` (fully rounded `.fm-badge`).

### 3.3 Elevation & Shadows

- **Panel Shadow**: `--shadow-panel: 0 1px 2px rgb(16 24 40 / 0.04)` (subtle card depth).
- **Popover / Dropdown Shadow**: `0 4px 16px rgb(16 24 40 / 0.12)`.
- **Modal Dialog Shadow**: `0 12px 32px rgb(16 24 40 / 0.18)` (`.fm-dialog`).
- **Modal Backdrop**: `rgb(16 24 40 / 0.35)` (`.fm-dialog::backdrop`).

---

## 4. Core UI Primitives (`frontend/src/components/ui/index.tsx`)

All views import presentation components from `components/ui` or use the `.fm-*` CSS classes defined in `portal.css`.

### 4.1 Buttons (`Button` / `.fm-btn`)

```tsx
<Button variant="primary | secondary | ghost | danger" size="sm">Action</Button>
```
- **Primary** (`.fm-btn--primary`): Burnt orange `--action-primary` with white text. Reserved for the primary task on the screen.
- **Secondary** (`.fm-btn--secondary`): Light grey surface `--surface-secondary`. Standard default button.
- **Ghost** (`.fm-btn--ghost`): Transparent background with border `--border-default`. Used for secondary/cancel actions.
- **Danger** (`.fm-btn--danger`): Red background `--status-danger` with white text. Used for destructive actions (e.g. reject, escalate).
- **Small Size** (`.fm-btn--sm`): Min-height 28px, padding 3px 10px, font-size 12.5px.

### 4.2 Status Badges (`StatusBadge` / `.fm-badge`)

```tsx
<StatusBadge tone="success | warning | danger | info | neutral | simulated | count">
  Label text
</StatusBadge>
```
- Always render readable label text inside; never use color in isolation.
- Fully rounded 999px pill with 11.5px semi-bold text.

### 4.3 Panels & Section Headers (`DataPanel`, `SectionHeader` / `.fm-panel`)

```tsx
<DataPanel title="Panel Title" actions={<Button size="sm">Export</Button>}>
  <p>Panel contents...</p>
</DataPanel>
```
- White surface, 1px `--border-default`, 10px radius, 16px padding.
- `SectionHeader` aligns a 15px bold `<h2>` title with right-aligned action buttons.

### 4.4 Alert Banners (`AlertBanner` / `.fm-banner`)

```tsx
<AlertBanner tone="info | warning | danger" title="Shortfall Detected">
  <p>Detailed explanation...</p>
</AlertBanner>
```
- Light-tinted full-width banners with bold header and optional body copy.
- Automatically assigns `role="alert"` for danger, `role="status"` for info/warning.

### 4.5 Empty States (`EmptyState` / `.fm-empty`)

```tsx
<EmptyState title="No active incidents">
  <p>All supply lines operating normally.</p>
</EmptyState>
```
- Centered container with dashed `--border-default` border and secondary text color.

### 4.6 Accessible Tabs (`Tabs` / `.fm-tabs`)

```tsx
<Tabs
  label="Recovery Views"
  value={activeTab}
  onChange={setActiveTab}
  tabs={[
    { id: "stock", label: "Stock Allocation", panel: <StockPanel /> },
    { id: "orders", label: "Order Protection", panel: <OrdersPanel /> },
  ]}
/>
```
- Accessible WAI-ARIA tablist supporting keyboard navigation: Arrow Left / Right to move, Home to jump to first, End to jump to last.
- Active tab highlighted by `--brand-primary-text` bottom border.

### 4.7 Dialogs (`.fm-dialog`)

- Native HTML dialog or accessible modal container with:
  - Focus trap (`FOCUSABLE` selector cycle on Tab / Shift+Tab).
  - Escape key handling to close.
  - Return focus to opening button upon dismissal.
  - Required reasons for state changes (e.g., `ReasonDialog` in P5).

### 4.8 Responsive Tables (`.fm-table-wrap`, `.fm-table`)

```html
<div class="fm-table-wrap">
  <table class="fm-table">
    <thead>
      <tr>
        <th scope="col">Menu item</th>
        <th scope="col">Confirmed</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Chicken Popcorn</th>
        <td>25</td>
      </tr>
    </tbody>
  </table>
</div>
```
- Always wrap tables in `.fm-table-wrap` for horizontal scroll on narrow viewports.
- Light grey header cells (`--surface-secondary`) with subtle border dividers.

---

## 5. Shell Layout & Responsive Breakpoints

### 5.1 Shell Layout Architecture

- **Header (`.portal-header`)**:
  - Sticky at top (`z-index: 10`, height `56px` `--header-height`).
  - Contains **MouManTAI** logo (172px width) on the left.
  - Outlet selector / demo badge on the right: **Outlet: Happy Potato** with the Happy Potato mark.
- **Sidebar (`.shell__sidebar`)**:
  - Sticky at left (width `232px` `--sidebar-width`).
  - Groups navigation items with collapsible group disclosures (`.nav__group-toggle`).
  - Active navigation item has `--brand-primary-soft` background and `--brand-primary-text` bold text.
- **Main Canvas (`.shell__main`)**:
  - Fluid width with 24px gutter (`--content-gutter`).
  - Every page wrapped by `PageContainer` (`.page`), rendering title and optional right-aligned actions toolbar.

### 5.2 Key Media Query Breakpoints

| Breakpoint | Target Form Factor | Layout Adaptations |
| :--- | :--- | :--- |
| **`> 1023px`** | Desktop | Full 232px sidebar with expandable navigation groups. Multi-column grids (2–4 cols). |
| **`<= 1023px`**| Tablet | Sidebar collapses to **60px icon rail** (`--sidebar-rail`). Group headers and text labels hide; icons remain centered. Main padding drops to 16px. |
| **`<= 850px`** | Small Tablet / Phablet | 2-column comparison grids and offer columns collapse to single-column stack. |
| **`<= 720px`** | Large Mobile | KPI strips and impact fact grids simplify. Graph detail drawers stack beneath the canvas. |
| **`<= 560px`** | Mobile | Header height expands to **72px** (`--header-height: 72px`) with a compact stacked layout. Metric grids drop to 2 columns. |
| **`<= 360px`** | Compact Mobile | Metrics and action button rows become 100% full-width vertical stacks. |

---

## 6. Guardrails, Do's & Don'ts

### What to DO
- **DO** use the shared presentation primitives in `components/ui/index.tsx` for all new UI screens.
- **DO** ensure all text on white surfaces passes at least **4.5:1** contrast (e.g., `--action-primary` is 5.66:1).
- **DO** use `--viz-physical` (`#475467`, slate grey) to represent physical accepted inventory stock.
- **DO** use `--status-simulated` (`#6941c6`, purple) to clearly label synthetic calculations and simulated actions.
- **DO** include `aria-label`, `role="tab"`, `role="region"`, or `role="alert"` attributes where interactive or dynamic elements appear.

### What NOT to DO
- **DO NOT** add dark-mode overrides or `@media (prefers-color-scheme: dark)`. The portal is strictly light-mode.
- **DO NOT** use brand orange (`#ff7823` or `#ad4808`) to represent physical stock in charts or allocation bars. Brand orange is reserved for actions, branding, and navigation.
- **DO NOT** convey state with color alone. Always provide text labels alongside badges, pills, and indicators.
- **DO NOT** hardcode raw hex codes in component JSX or feature styles; always refer to CSS custom properties from `tokens.css`.
- **DO NOT** use banned wording anywhere in the UI:
  - ❌ "ROI"
  - ❌ "profit"
  - ❌ "savings"
  - ❌ "SYNCED" (always use "awaiting manual update", "not synced to POS", or "simulated local only")
  - ❌ "AI recommends" (use "Plan A / Plan B proposals" or "heuristics")
  - ❌ "Chicken Rice" (the demo menu items are strictly Chicken Popcorn, Chicken Tenders, Happy Combo, and Flavoured Fries)
  - ❌ "orders breached" (confirmed orders are protected first; unmet demand is forecast gap, not cancellations)

