# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flux pricing calculator for coach manufacturer deals (SRS model). Two-part pricing structure separating Year 1 (Sales team) from Year 2+ (Support team). Simplified 2-layer discount model based on volume commitment and contract length.

## Pricing Model

### Part Numbers (by contract length)

- `FX-SRS-1YR` — 1-year contract per unit
- `FX-SRS-3YR` — 3-year contract per unit
- `FX-SRS-5YR` — 5-year contract per unit
- `FX-SRS-10YR` — 10-year contract per unit

Each contract includes Year 1 pricing plus Year 2+ annual pricing for remaining years.

### Base Prices (no commitment)

```javascript
Year 1 base:  $3,600  (hardware + build + first year support)
Year 2+ base: $1,550/year (support + hardware reserve)
5-year total: $9,800  (Y1 + 4×Y2+)
```

### 2-Layer Discount Structure

**Layer 1: Volume Commitment (0-25%)**

Based on total units committed = monthly rate × 12 × duration years

| Total Commitment | Volume Discount |
|------------------|-----------------|
| 0-119 units      | 0%              |
| 120-239 units    | 10%             |
| 240-359 units    | 15%             |
| 360-499 units    | 20%             |
| 500+ units       | 25%             |

- Year 1 gets **50%** of volume discount
- Year 2+ gets **full** volume discount

**Layer 2: Contract Length (0-18%)**

| Contract | Discount |
|----------|----------|
| 1-year   | 0%       |
| 3-year   | 3%       |
| 5-year   | 5%       |
| 10-year  | 18%      |

### Example: 500 units + 5-year contract

```javascript
// Y1: 12.5% volume (25% × 0.5) + 5% contract = 17.5%
Y1 = $3,600 × 0.825 = $2,970 → rounds to $3,000

// Y2+: 25% volume + 5% contract = 30%
Y2+ = $1,550 × 0.70 = $1,085 → rounds to $1,100/year

// Total 5-year contract
Total = $3,000 + (4 × $1,100) = $7,400/unit
```

### Costs & Margins

```javascript
// Costs (from config.js)
Y1 cost:  $1,475 (hardware $950 + build 3hrs + support 8hrs + coord 4hrs @ $35/hr)
Y2+ cost: $470/year (support 8hrs @ $35/hr + hardware reserve $190/yr)

// Margins at max discount (43% off Y2+)
Y1 margin:  42% ($2,550 price, $1,475 cost)
Y2+ margin: 48% ($900 price, $470 cost)
```

### Key Design Decisions

1. **Y2+ priced higher than original table** — captures $1M+ more over deal lifetime
2. **Healthy margins maintained** — never drops below 40% even at max discount
3. **Commitment-based** — rewards upfront volume commitment, not just fleet size
4. **Separate part numbers** — Sales team sells Y1, Support team sells Y2+

## Calculator Web App

**Files:**
- `config.js` — pricing parameters and discount tiers
- `pricing.js` — calculation functions
- `index.html` — customer-facing calculator
- `margins.html` — internal margin analysis

**Inputs:**
- Monthly order rate slider (10-25 units/mo)
- Commitment duration slider (1-5 years)
- Contract length buttons (1/3/5/10 year)

**Outputs:**
- Total commitment display (derived)
- Volume tier table with current tier highlighted
- Per-unit pricing table by contract length
- Discount breakdown (Volume + Contract)

**Tech:** Vanilla JS, Chart.js, client-side only

## Publishing (GitHub Pages — fluxinc)

GitHub Pages is served from the `fluxinc/srs-pricing` repo. Publish by pushing the current branch to the `fluxinc` remote.

```bash
git push fluxinc master
```

Notes:
- Pages serves from the repo root; `_config.yml` excludes internal docs.
- Public page: `index.html`. Internal analysis: `margins.html`.
- Auto-publish on commit is enabled via `.githooks/post-commit` (local Git config: `core.hooksPath=.githooks`).
- Disable auto-publish with `SRS_DISABLE_AUTO_PUBLISH=1` for a single commit/session.

## External Tools

```bash
# Google Sheets
gog sheets get SHEET_ID "Range" --json
gog sheets update SHEET_ID "Range" --values-json '[["data"]]' --input USER_ENTERED

# Obsidian vault (part numbers, docs)
qmd query "search terms"
```
