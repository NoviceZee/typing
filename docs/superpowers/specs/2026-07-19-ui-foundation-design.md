# Typing Station UI Foundation Design

**Date:** 2026-07-19
**Status:** Approved for implementation planning
**Scope:** Authenticated UI foundation across Profile, Friends, Account, Library, Leaderboard, Training, and Settings

## Purpose

Typing Station should feel like one compact, mature, typing-first product without presenting every section as a card. This pass standardizes page geometry, surface hierarchy, spacing, borders, radii, shadows, and reusable control variants. It changes presentation mechanics only; it does not add features, alter typing behavior, or redesign page content.

The visual direction remains a restrained modern typing terminal with subtle station/control-panel influence. Practice remains the visual reference. Landing-page and FAQ hero presentation are outside this scope.

## Current-State Audit

- `PageContainer` and `PageHeader` already align Profile, Library, Leaderboard, and Settings at a shared `72rem` maximum width, while Training uses the wider centered typing layout.
- `SecondaryNavigation` currently provides `FilterControl`, `SectionTabs`, and `IconButton`, but primary, secondary, destructive, segmented, and page-local controls still repeat Tailwind combinations.
- Profile contains the most surface duplication: numerous nested `border-paper/10`, `rounded-md`, and tinted surface declarations inside already grouped sections.
- Settings still frames every major section despite its left navigation already providing hierarchy.
- Library and Leaderboard have clearer structural boundaries, but Library passage rows and setup groups still mix container and item borders.
- Existing theme variables provide the raw palette and typography scale, but not a shared semantic contract for ordinary surfaces, emphasis surfaces, borders, radii, elevation, or page-section rhythm.
- Large glow shadows in the scoped authenticated pages are already limited to the Friends popover and Account dialog. Those two overlay exceptions must remain.

## Design Principles

1. Ordinary page sections are transparent and have no border, radius, or shadow.
2. Section hierarchy comes from headings, consistent vertical spacing, and adjacent-section dividers where needed.
3. Nested subsections are not placed inside additional surfaces unless containment communicates interaction, selection, warning, or structured data.
4. Soft tinted backgrounds are reserved for active/selected states, important summary stats, informational or warning states, and compact grouped controls.
5. Bordered or elevated surfaces are reserved for dialogs, popovers, dropdowns, structured tables, form controls, and clearly interactive containers.
6. Selected states use both colour and a non-colour cue.
7. All themes retain their existing palette identity; semantic state surfaces derive from theme variables rather than hard-coded colours.
8. Existing responsive behavior, focus behavior, ARIA semantics, dialog behavior, and typing interactions are preserved.

## Semantic Tokens

The implementation will add the following semantic CSS custom properties. Values that depend on the theme derive from existing palette variables.

```css
:root {
  --surface-subtle: rgb(var(--color-paper) / 0.035);
  --surface-hover: rgb(var(--color-paper) / 0.055);
  --surface-emphasis: rgb(var(--color-paper) / 0.06);
  --surface-selected: rgb(var(--color-accent) / 0.09);

  --color-danger-semantic: var(--typing-wrong);
  --color-warning-semantic: var(--chart-warning);
  --surface-danger: rgb(var(--color-danger-semantic) / 0.08);
  --surface-warning: rgb(var(--color-warning-semantic) / 0.09);

  --border-subtle: rgb(var(--color-paper) / 0.08);
  --border-control: rgb(var(--color-paper) / 0.12);
  --border-emphasis: rgb(var(--color-accent) / 0.28);
  --border-danger: rgb(var(--color-danger-semantic) / 0.28);
  --border-warning: rgb(var(--color-warning-semantic) / 0.30);

  --radius-control: 0.375rem;
  --radius-surface: 0.5rem;
  --radius-overlay: 0.625rem;

  --space-control: 0.5rem;
  --space-row: 1rem;
  --space-subsection: 1.5rem;
  --space-section: 2rem;
  --space-page-first: 1.5rem;
}
```

`--typing-wrong` and `--chart-warning` already vary with the active theme. Danger and warning text, surfaces, and borders therefore remain theme-aware. No warning or danger derivative may use a hard-coded RGB value.

Spacing remains based on the existing 4px/8px rhythm. Shared section layout uses `24px` vertical separation on mobile and `32px` from the medium breakpoint upward.

## Radius and Elevation Contract

- Controls: `6px`.
- Normal structured surfaces: `8px`.
- Dialogs and popovers: `10px` unless an existing overlay requires the current `8px` radius for compatibility.
- Pill radius is reserved for status chips, progress tracks, and true capsule controls.
- Ordinary content receives no shadow.
- Existing Friends popover and Account dialog `shadow-glow` treatments remain unchanged.
- Menus, dropdowns, notification panels, and dialogs may use overlay elevation.

## Page Geometry

### Standard pages

Profile, Friends, Account, Library, Leaderboard, and Settings use:

- `PageContainer`: `width: 100%`, `max-width: 72rem`, centered.
- Authenticated shell padding: `16px` on mobile and `24px` from the medium breakpoint.
- `PageHeader`: eyebrow-to-heading `8px`; heading-to-description `8px`; header-to-first-section `24px`.
- `SectionStack`: `24px` vertical gap on mobile and `32px` from the medium breakpoint.

No scoped page may add compensating top margins around `PageHeader` or its first section.

### Wide typing exceptions

Practice and Training retain their current centered typing-stage width and interaction geometry. Training adopts shared control variants but does not move its typing passage into the standard `72rem` page layout.

## Shared Surface Components

### `PageSection`

Default section primitive:

- Transparent background.
- No border, radius, or shadow.
- Standard heading/content spacing.
- Optional semantic label and description slots without decorative icons.

`PageSection` does not independently render a top divider.

### `SectionStack`

Controls spacing and adjacent dividers:

- `spacing="page"`: `24px` mobile / `32px` desktop.
- `spacing="subsection"`: `24px` at all widths.
- `divided`: applies a subtle top border and matching top padding only to adjacent children using an adjacent-sibling rule (`> * + *`).
- The first child never receives a top divider.

### `EmphasisSurface`

Used selectively rather than as the default section wrapper:

- `soft`: `--surface-subtle`, no border.
- `selected`: `--surface-selected` plus `--border-emphasis` only when the selected item requires a bounded interactive target.
- `info`: theme-neutral subtle surface with an optional subtle border.
- `warning`: `--surface-warning` and `--border-warning`.
- `danger`: `--surface-danger` and `--border-danger`.

All variants use `--radius-surface`. Informational, warning, and danger semantics retain their current live-region and alert roles where present.

### `DataSurface`

Reserved for tables and horizontally scrollable structured data:

- Subtle structural border.
- `--radius-surface`.
- Transparent or minimally tinted background.
- Internal header and row dividers.
- No drop shadow.

## Shared Control Components

### `Button`

Sizes:

- `compact`: `32px` visual height.
- `default`: `36px` visual height.

Variants:

- `primary`: soft accent background, accent border, accent text.
- `secondary`: transparent background, control border, primary text.
- `ghost`: transparent with hover surface and no border.
- `danger`: danger text, danger border, and danger surface.

All variants preserve disabled opacity/cursor behavior and a visible two-pixel focus ring.

### `IconButton`

Variants: `ghost`, `subtle`, and `danger`.

- Desktop visual size: `32px`.
- Touch layouts: at least `44px` effective target, implemented with responsive `44px` sizing or a non-overlapping expanded hit area.
- Icon size: `18px`, `strokeWidth={1.75}`.
- Accessible label: always required.
- Tooltip/title: required for unfamiliar or ambiguous actions; optional for universally understood actions when the accessible name remains available to assistive technology.

### `Tab`

Variants:

- `toolbar`: transparent; selected state uses accent text plus semibold weight and a two-pixel underline/indicator.
- `sidebar`: full-row target; selected state uses accent text, semibold weight, and `--surface-selected`.

Tabs preserve the appropriate `aria-current="page"` or `aria-selected="true"` semantics. Focus, hover, and disabled states apply to the complete target.

### `FilterControl`

- Transparent inline option with no individual border.
- Selected state uses accent text plus semibold weight and a visible two-pixel indicator or subtle selected surface according to group context.
- Toggle-style filters retain `aria-pressed`.
- Controls used as tabs use `aria-selected` through the `Tab` primitive instead of `aria-pressed`.

### `SegmentedControl`

- Optional `--surface-subtle` group background.
- `--radius-surface` container with `2px` internal padding.
- Individual items have no border.
- Selected item uses `--surface-selected`, semibold weight, and the correct pressed or selected semantic.
- Group label remains programmatically associated through `aria-label` or `aria-labelledby`.

## Mechanical Page Migration

### Profile

Profile receives the strongest simplification:

- Identity, summary, trends, consistency, categories, activity, challenges, achievements, typing insights, and history become transparent `PageSection` instances.
- Adjacent major sections use shared `SectionStack` spacing and selective dividers.
- Small metrics stop rendering as independently bordered cards. Important summary metrics may use `EmphasisSurface soft` without borders.
- Tables, result history, heatmaps requiring a bounded interaction region, and structured comparison data use `DataSurface`.
- Status, selected, achievement, and warning states retain meaningful emphasis.

### Friends

- Request and blocked-user groups become transparent sections with divided rows.
- The friends comparison table retains `DataSurface` structure and horizontal scrolling.
- Destructive actions retain labels or accessible names and danger treatment.
- The Add Friend popover retains its existing glow shadow.

### Account

- Identity, Security, and Notifications become transparent sections with shared row dividers.
- Delete Stats and Delete Account retain danger emphasis derived from semantic danger tokens.
- Form controls retain borders.
- The Account dialog retains its existing glow shadow and focus-trap behavior.

### Settings

- The desktop left navigation remains above Live Preview in the sticky left column.
- The mobile navigation remains a horizontally scrollable tab row.
- Major Behavior, Appearance, Typing, and Sound sections lose their outer border, radius, background, and shadow.
- Individual setting rows use adjacent dividers where scanning benefits.
- Live Preview retains a subtle structural boundary because it is a bounded interactive preview.
- Theme preview, accent, and sound choices migrate to shared control variants without changing persistence or automatic-save behavior.

### Library

- Setup and Available Passages become transparent sections.
- Filter groups use shared filters/segmented controls.
- Passage items become divided rows with no default border or radius.
- Only the selected passage receives selected emphasis; the practice action uses the shared button.
- Empty/loading states retain soft informational emphasis.

### Leaderboard

- Header, metric, and filter areas remain transparent.
- Filters use shared toolbar/filter primitives with non-colour selected indicators.
- The leaderboard table remains a `DataSurface` with row dividers and no shadow.
- The user's own result retains selected emphasis.

### Training

- Training retains its current wide, centered typing layout.
- Content, mode, length, and difficulty controls migrate to shared filter/segmented variants.
- Typing passage size, timer behavior, keyboard handling, IME behavior, and result behavior remain unchanged.

## Files and Component Boundaries

### Shared foundation

- Create `components/Controls.tsx`: `Button`, `IconButton`, `Tab`, `FilterControl`, and `SegmentedControl`.
- Create `components/Surface.tsx`: `PageSection`, `SectionStack`, `EmphasisSurface`, and `DataSurface`.
- Update `components/SecondaryNavigation.tsx`: compose and re-export shared tab/filter/icon-button primitives while retaining toolbar grouping.
- Update `components/PageLayout.tsx`: formalize standard width and first-section spacing without changing authenticated header geometry.
- Update `styles/globals.css`: add semantic tokens and any shared component-layer utilities.
- Update `tailwind.config.ts`: expose semantic surface, border, radius, and state colours without hard-coded danger/warning derivatives.

### Scoped pages

- `pages/profile.tsx`
- `pages/profile/friends.tsx`
- `pages/profile/account.tsx`
- `pages/passages.tsx`
- `pages/leaderboard.tsx`
- `pages/settings.tsx`
- `pages/training.tsx`

Landing-page and FAQ hero files are explicitly excluded.

## Accessibility Contract

- Existing landmarks, heading order, live regions, dialogs, labels, and keyboard interactions remain intact.
- Selected states never rely on colour alone.
- `aria-current`, `aria-selected`, and `aria-pressed` are applied according to interaction semantics rather than visual similarity.
- Icon-only controls always have accessible labels.
- Ambiguous icon-only controls have visible-on-hover/focus tooltips or native titles.
- Touch layouts provide at least `44px` effective targets for icon-only controls.
- Focus indicators remain visible across all themes and are not clipped by overflow containers.

## Verification and Acceptance

### Automated

- Add `lib/ui-foundation.test.tsx` with fail-first tests for shared control variants, selected-state semantics, first-section divider behavior, and IconButton accessible/touch-target contracts.
- Update affected page tests only where shared components change rendered structure, not feature behavior.
- Run TypeScript, ESLint, focused page tests, and the complete test suite.

### Visual

Check authenticated desktop and `390px` mobile layouts for Profile, Friends, Account, Library, Leaderboard, Settings, and Training.

Confirm:

- Standard page headings and first sections align.
- Settings navigation remains on the left on desktop and horizontal on mobile.
- Ordinary sections have no frame or shadow.
- Adjacent dividers never appear before the first section.
- Structured tables remain understandable.
- Selected and interactive states remain visible without relying only on colour.
- Icon-only touch targets meet the `44px` effective minimum on touch layouts.
- No page has horizontal document overflow.
- Practice/Training typing interactions and responsive typing layouts are unchanged.
- Friends popover and Account dialog glow shadows remain.

## Non-Goals

- No new product features.
- No content or information-architecture redesign.
- No landing-page or FAQ hero changes.
- No new decorative icons.
- No typing passage, timer, IME, result, persistence, authentication, or responsive-flow changes.
- No replacement of existing themes or theme-specific palettes.
