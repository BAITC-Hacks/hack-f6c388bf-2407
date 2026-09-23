---
version: alpha
name: "Аким на 5 часов"
description: "A civic planning workspace for making five accountable decisions for Astana."
colors:
  primary: "#247568"
  background: "#f4f6f8"
  surface: "#ffffff"
  ink: "#202d3b"
  muted: "#667381"
  navy: "#152c36"
  border: "#e3e8ed"
  danger: "#b23f40"
typography:
  sans:
    fontFamily: '"Segoe UI", system-ui, sans-serif'
  display:
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
  mono:
    fontFamily: '"Cascadia Code", Consolas, monospace'
rounded:
  DEFAULT: "0.75rem"
  sm: "0.5rem"
  lg: "1rem"
spacing:
  section-gap: "1.5rem"
  page-max: "100rem"
components:
  button: {}
  card: {}
  select: {}
  toast: {}
---

# Аким на 5 часов Design System

## Overview

### Creative North Star
A city planner's atlas: a quiet, precise workspace with a schematic of Astana's five synthetic districts as its signature. The existing navy/mint identity moves into the navigation and score panel; white work surfaces improve dense information scanning.

### Product context and register
Russian-language product for a Kazakhstan civic simulation hackathon, city managers and analysts. Desktop presentation and mobile exploration are equally supported. Five decisions, fixed synthetic budget, deterministic server-owned scoring. Evidence: `docs/architecture.md`, `data/`, and `contracts/openapi.yaml`. No Japan-market behavior applies. No financial transactions or personal data.

Runtime CSS is canonical (token ownership model B): `apps/web/src/style.css :root` → shared components. This document mirrors approved values and explains them; there is no second theme adapter. `scripts/check-design.mjs` verifies normative colors, font families, radii and spacing against CSS. UX ownership is in `UX-CONTRACT.md`.

## Colors
Primary green is for actions and positive changes; navy anchors navigation and the score. Off-white canvas, white panels, subtle borders, ink and muted text provide hierarchy. Five category colors remain supplemental to text/icons. Error is red with explanatory text. The supported theme is light with deliberately dark navigation and score surfaces, not a user-selectable dark mode. Forced colors retain native control/focus visibility.

## Typography
Segoe UI/system sans supports Russian with no late webfont swap. Trebuchet MS is used sparingly for display headings and large scores. Monospace is reserved for formula/indicator codes. Tabular numerals stabilize changing scores. Body 14px/1.55; page heading 28–32px; card headings 16–18px; captions never below 11px.

## Layout
224px sidebar; centered content up to 100rem; 24px section rhythm. Four summary cards, a wide district map beside score, five category metrics, then catalog with a scenario rail. Below 1200px navigation narrows and below 900px the rail enters normal flow. Below 700px navigation becomes a compact horizontal shell and all content stacks. The document owns vertical scrolling; only bounded horizontal lists/tables scroll internally. No viewport-locked form panels.

## Elevation & Depth
Quiet borders and minimal shadow on white cards. Navigation, score and map provide subject-specific hierarchy. Toasts float above content; ordinary panels do not use glass, gradients or decorative shadows.

## Shapes
Cards 1rem radius, controls 0.5rem, compact panels 0.75rem. Status pills are small and always contain text. Icons use 20px consistent outline SVG, with 1.7px strokes.

## Components

### Foundational visual states
Native buttons, links and selects with 44px primary targets, explicit hover/pressed/disabled styles and 3px visible focus. Disabled actions show the rule that prevents them. Busy controls preserve geometry and expose aria-busy. Global scrollbars use tokenized track/thumb/hover/active, standards properties and WebKit fallback; forced-colors restores system values.

### Buttons and actions
Primary: run simulation/add initiative. Secondary: load example/export. Tertiary: remove/reset with undo. Primary green on white; high-contrast mint action on navy. Spinner replaces icon without changing label width.

### Navigation and data display
Real section anchors with current-location indication. Synthetic map is explicitly labeled; district controls have text and keyboard equivalents. Bounded district table has native semantics and a horizontal overflow container. Category filters are pressed buttons, not incomplete ARIA tabs.

### Forms and overlays
DistrictSelect is the one canonical native select. Platform popup geometry is accepted; closed control uses shared tokens. Errors are persistent and actionable. One shared Toast owns polite success/undo notifications. No modal is necessary for reversible local scenario reset.

### Iconography
One shared Icon component with a small project-owned outline vocabulary. Decorative icons are aria-hidden. All actions retain text or a specific accessible label.

### Motion
160ms color/border/opacity transitions; score/bar updates use 240ms. No perpetual decorative animation. Reduced-motion removes transitions, animation and smooth scrolling.

### Content and data visualization
Plain Russian, ru-RU number formatting, virtual units explicitly labeled. The required English score name remains recognizable. Incomplete scenario is a forecast, never a validated final score. AI unavailable status is honest and separate from deterministic explanatory text.

## Do's and Don'ts
- Do make budget, chosen decisions and the weakest district visible together.
- Do reuse shared controls across catalog and selected scenario.
- Don't invent city data, AI output, monetary currency, or geographic boundaries.
- Don't let visual polish obscure delays, conflicts, negative effects or critical values.
