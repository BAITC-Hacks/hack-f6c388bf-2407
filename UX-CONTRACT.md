# Simulator interaction contract

Business sources: `data/city.json`, `data/initiatives.json`, `docs/architecture.md`, `contracts/openapi.yaml`. The supplied dataset requires exactly five decisions with at most two per domain, not one compulsory decision in each domain. All five domains remain selectable. Server owns rules and calculations. No permissions, billing, irreversible lifecycle, personal data or legal workflows apply.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | `apps/web/src/components/ui.tsx` DistrictSelect | This contract | native platform popup | keyboard + browser |
| Form | `apps/web/src/hooks/useScenario.ts` | API validation | add/remove/replace draft | API + browser |
| Scrollbar | `apps/web/src/style.css` | DESIGN.md | global baseline | computed style |
| Toast | `apps/web/src/components/ui.tsx` Toast | This contract | success + undo | live-region + browser |

## Workflow and state
- Catalog → loading → ready or persistent retryable error. No fake offline scoring.
- Add initiative → update local selection/budget presentation → server preview → refreshed metrics/eligibility. Never accept an add without current eligibility. In-flight changes disable additions and simulation. Removing remains available for recovery.
- Preview permits 0–5 decisions but applies every other validation rule. It is explicitly provisional. Evaluate requires exactly five, recomputes on server and optionally asks AI to explain already computed numbers.
- Each request has timeout and cancellation. Superseded responses cannot overwrite newer decisions. Editing invalidates the final result immediately. Double submission is blocked synchronously.
- Preview failure preserves choices and offers retry; stale metrics are labeled. Initial baseline stays identifiable.
- All 14 catalog entries are bounded and may be rendered at once; no pagination required. Five category filters, query and selected-only filter are transient discovery controls, intentionally local to this single workspace. Their state does not change selected decisions.
- Local-only scenario draft persists on this browser. Reads validate shape, writes catch storage failures. A restored draft is labeled and validated by the server. Unsaved volatile work gets a beforeunload guard if local persistence fails.
- Reset is reversible through Undo and clears results. No blocking confirmation for reversible local edits.
- Export downloads a text report from the latest evaluated scenario only; stale/partial data cannot be exported.
- AI off/unavailable never masquerades as AI. Deterministic model explanations remain available, clearly labeled.

## Navigation, accessibility and locale
Native section links retain browser history and keyboard behavior. Mobile navigation remains reachable without a modal drawer. Russian labels, aria labels and number formatting; document lang=ru. Category metric cards and district table provide textual alternatives to map/chart colors. Native select permits standard keyboard and platform popup. Global focus, reduced-motion, forced-colors and narrow-screen reflow are mandatory.
