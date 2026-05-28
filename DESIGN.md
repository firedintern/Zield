# Zield Design System

**Product**: Risk-aware yield vault optimizer on Base  
**Audience**: DeFi users who want better risk-adjusted returns without chasing raw APY  
**Tone**: Calm, sophisticated, trustworthy, transparent  
**Platform**: Web (desktop-first, mobile responsive)

## Core Principles

1. **Trust through clarity** — Every number and decision must be explainable. No black boxes.
2. **Premium minimalism** — Dark theme, generous whitespace, excellent typography. Less is more.
3. **User-friendly power** — Advanced users get depth; new users get guided, non-patronizing explanations.
4. **Data over decoration** — Every visual element should communicate something useful.
5. **Calm confidence** — The interface should feel like a professional tool, not a gambling app.

## Visual Language

### Colors (Dark Theme)

**Backgrounds**
- `--bg-0`: #0A0A0C (deepest)
- `--bg-1`: #111113 (cards, surfaces)
- `--bg-2`: #1A1A1D (elevated surfaces, modals)

**Text**
- `--text-primary`: #F4F4F5 (high emphasis)
- `--text-secondary`: #A1A1AA (supporting)
- `--text-tertiary`: #71717A (subtle)

**Accent / Semantic**
- `--accent`: #22C55E (emerald-500) — positive yield, safe
- `--warning`: #F59E0B (amber-500) — higher risk
- `--danger`: #EF4444 (red-500) — critical
- `--info`: #3B82F6 (blue-500) — neutral data

**Borders**
- `--border`: #27272A
- `--border-strong`: #3F3F46

### Typography

- **Sans**: Inter / system-ui (primary)
- **Mono**: JetBrains Mono / ui-monospace (numbers, addresses, tx hashes)
- **Scale**:
  - Display: 48-56px / 600
  - H1: 32-36px / 600
  - H2: 24px / 600
  - Body: 14-15px / 400-500
  - Small: 12px / 400
  - Micro: 10-11px / 500 (for labels, data)

### Spacing (8pt base)

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-12`: 48px

Cards use 24px internal padding, 16-24px gaps between sections.

### Elevation & Radius

- Cards: 1px border + subtle shadow `0 1px 3px rgba(0,0,0,0.3)`
- Modals: stronger shadow + backdrop blur
- Radius: 16px for cards, 12px for buttons/inputs, 999px for pills

## Key Screens & Patterns

### Dashboard (Main Experience)

**Information Hierarchy**:
1. Top: Portfolio health at a glance (APY + Risk score + TVL)
2. Keeper Recommendation (the star of the product)
3. Allocation view (visual + detailed)
4. Your position + actions (Deposit / Withdraw)
5. Transparency layer (Recent activity + Simulation)

**Critical Patterns**:
- Never hide important numbers behind clicks.
- Risk information should be glanceable but explainable on demand.
- Actions should feel deliberate, not gamified.

### Design Tokens (CSS Variables)

```css
:root {
  --z-bg-0: #0A0A0C;
  --z-bg-1: #111113;
  --z-bg-2: #1A1A1D;

  --z-text-primary: #F4F4F5;
  --z-text-secondary: #A1A1AA;
  --z-text-tertiary: #71717A;

  --z-accent: #22C55E;
  --z-warning: #F59E0B;
  --z-danger: #EF4444;
  --z-info: #3B82F6;

  --z-border: #27272A;
  --z-border-strong: #3F3F46;

  --z-radius: 16px;
  --z-radius-sm: 12px;
}
```

## Component Guidelines

- **Cards**: Always have subtle borders. Never rely on shadow alone in dark mode.
- **Numbers**: Always use tabular-nums + mono font.
- **CTAs**: Primary = solid white on dark. Secondary = subtle border. Never use bright green as primary CTA (reserve green for positive data).
- **Risk indicators**: Use both color *and* text. Color alone is not enough.
- **Explanations**: Use small, calm info icons or "(lower is safer)" style inline text rather than heavy tooltips where possible.

## Current Gaps (to address in redesign)

- The current dashboard feels a bit "MVP" — cards are functional but not distinctive.
- Withdraw still feels tacked on.
- Risk concepts need better progressive disclosure.
- The simulation modal is functional but can feel more premium and reassuring.
- Overall visual rhythm and breathing room can be improved.

This document should guide all future visual work on the Zield frontend.