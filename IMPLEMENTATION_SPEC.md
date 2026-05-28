# Zield Dashboard — Implementation Spec (Full Visual Redesign)

**Date:** 2026-05-28  
**Mode:** Plan-driven (using DESIGN.md)  
**Goal:** Elevate the main dashboard from functional MVP to premium, calm, trustworthy DeFi product that feels both sophisticated and highly usable.

## Visual Direction

- Deep, rich dark theme (almost black with warm-neutral undertones)
- Generous whitespace and breathing room (feels expensive)
- Excellent typography hierarchy (Geist is already good — use it deliberately)
- Data is calm and authoritative, not flashy
- Risk information is prominent but never alarming unless it should be
- Every section has a clear job; nothing feels tacked on

## Layout Structure (New Proposed)

**Top (Persistent)**
- Refined header (logo + network + wallet) — very minimal

**Hero / Overview (One strong row)**
- Left: Big "Risk-Adjusted Yield" + short value prop
- Right: Two dominant numbers (Blended APY + Portfolio Risk) with tiny excellent labels
- Very subtle "Connect to interact" prompt when not connected

**Primary Command Center: Keeper Recommendation**
- This is the hero of the product.
- Make it feel like the most important thing on the screen.
- Clear verdict (Execute / Blocked) with strong visual treatment.
- Key numbers (Expected Profit, Gas, Benefit Ratio) in a tight premium row.
- Prominent "Simulate Rebalance" action.
- One-sentence rationale visible by default + expandable deeper explanation.

**Two-Column Main Content**

Left Column (wider):
- Allocation Overview (title + explanation)
  - Beautiful combined visualization: Horizontal bars + small elegant donut/pie
  - Each row has: Name • Current % • Risk badge • APY
  - Subtle "Risk-capped" callout

Right Column:
- Your Position (very clear card)
  - Current zUSDC balance + estimated USD value
  - Deposit and Withdraw as two clean, equal-weight but clearly separated actions
  - Excellent empty states when no position

**Transparency Layer (bottom)**
- Recent Keeper Activity (now with real on-chain data when available)
- Feels like an audit log — calm, factual, reassuring

## Component & Interaction Upgrades

- Cards: Consistent 1px border + very subtle inner shadow or none. Use elevation via background color more than shadows.
- Numbers: Always tabular-nums + slightly tighter tracking.
- Risk badges: Small, elegant, color + text. Never just color.
- Buttons: Primary = clean white or subtle emerald. Secondary = ghost with border. Never bright green as primary.
- States: Loading uses soft skeleton blocks. Disabled states use reduced opacity + clear reason text when possible.
- Explanations: Inline subtle text or very light info icons. Prefer "lower is safer" style over heavy tooltips for core concepts.

## Specific Screens / States to Handle Beautifully

1. **Not connected** — Warm, inviting, low-pressure. Clear value + easy connect.
2. **Connected but no position** — Encouraging but not pushy. "Start by depositing USDC".
3. **Has position** — Calm confidence. Clear "Your capital is being actively managed".
4. **Simulation modal** — Elevated, serious, transparent. Feels like reading an analyst report.

## Technical Notes

- Use the design tokens already defined in DESIGN.md and now in globals.css.
- Prefer composition over huge single components (start extracting more).
- Keep all real functionality (wagmi calls, etc.) intact during redesign.
- Maintain excellent performance and accessibility.

This spec should result in a dashboard that feels like a serious, modern institutional-grade tool while remaining approachable for sophisticated retail DeFi users.
