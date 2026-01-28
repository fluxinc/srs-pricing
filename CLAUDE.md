# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flux pricing calculator for coach manufacturer deals (SRS model). Two-part pricing structure separating Year 1 (Sales) from Year 2+ (Service). Discounts emerge naturally as install base grows past the FTE cliff.

## Pricing Model

### Part Numbers

- `FX-SRS-Y1` — Year 1: Hardware + Build Labor + First Year Support (fixed price)
- `FX-SRS-Y2` — Year 2+: Support + Hardware Reserve (price decreases with scale)

### Key Parameters

```javascript
const PARAMS = {
  hardwareCost: 895,
  hardwareReserveRate: 0.20,  // 20% annually for 5-year replacement
  buildHoursPerUnit: 4,
  supportHoursPerUnitYear: 8,
  hourlyRate: 60,
  fteSalary: 60000,
  fteHours: 2000,
  fteThreshold: 0.5,
  targetMargin: 0.40,
};
```

### Core Formulas

```javascript
// FTE cliff occurs at this install base
const fteCliffUnits = ceil(0.5 * (2000 / 8)) = 125 units

// Year 1 cost (fixed)
year1Cost = hardware + (buildHours * hourlyRate) + (supportHours * hourlyRate)
          = 895 + 240 + 480 = $1,615
year1Price = 1615 / 0.6 = $2,692

// Year 2+ cost (varies with install base)
if installBase < 125:
  supportCost = 8 * $60 = $480/unit
else:
  supportCost = (ceil(installBase/250) * $60k) / installBase

year2Cost = supportCost + ($895 * 0.20)
year2Price = year2Cost / 0.6

// At 125 units: ~$1,098  (0% discount)
// At 250 units: ~$698    (36% discount)
```

### The Discount Incentive

Higher order rates reach the FTE cliff faster, so Year 2+ costs drop sooner. This naturally incentivizes volume without sacrificing margin.

## Calculator Web App

A single-page app with:

**Inputs:**

- Monthly order rate slider (5-50 units/mo)
- Projection period (1, 2, 3, 5 years)

**Outputs:**

- Price over time chart (Year 2+ price vs months)
- FTE cliff indicator
- Discount % achieved
- Cumulative cost projection

**Tech:** Vanilla JS or React, Chart.js, client-side only (no backend)

## External Tools

```bash
# Google Sheets
gog sheets get SHEET_ID "Range" --json
gog sheets update SHEET_ID "Range" --values-json '[["data"]]' --input USER_ENTERED

# Obsidian vault (part numbers, docs)
qmd query "search terms"
```
