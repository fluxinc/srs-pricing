# Plan: Installed-Base Cost-Plus Pricing (Perpetual Overhead + Scale)

## Overview

Shift from fixed base pricing to a cost-plus model that:
- Prices **Year 1** higher (sales dept pays) with a configurable margin.
- Prices **Year 2+** for resale based on *installed base* economics.
- **Amortizes overhead every year** based on installed base (perpetual), with an option to exclude or reduce it in Year 1.
- Reflects **efficiency of scale** (support hours per unit fall as the fleet grows) and **efficiency over time** (existing decay model).
- **Incentivizes commitment** via volume + contract discounts.
- Stays **roughly congruent** with the previously sent 1/3/5/10-year all‑in price table for full upfront commitment.

## Key Requirements (from stakeholder)

- Overhead is annual and should be amortized across the installed base in perpetuity.
- Year 1 can omit overhead (optional) since labor is already fully captured.
- Year 2+ annual rate for the **existing fleet** must **decrease with the scale** of already deployed units.
- Include **economies of scale** in support costs.
- Preserve commitment incentives and a higher initial rate.
- Keep output roughly aligned to the existing quote table for full upfront commitment.

## Proposed Model

### Definitions

Inputs:
- `monthlyRate` (units per month)
- `commitYears` (ramp/commit duration)
- `contractYears` (per-unit contract length)
- `existingFleetUnits` (already deployed at start)

Derived:
- `commitmentUnits = monthlyRate * 12 * commitYears`
- `unitsAddedByYear(y) = monthlyRate * 12 * min(y, commitYears)`
- `installedBaseStart = existingFleetUnits`
- `installedBaseEnd = existingFleetUnits + unitsAddedByYear(commitYears)`
- `avgInstalledBaseForYear(y)` (linear ramp assumption):
  - `existingFleetUnits + unitsAddedByYear(y) - (0.5 * monthlyRate * 12)`
  - clamp to `existingFleetUnits` minimum

### Scale Efficiency (support hours)

Support hours per unit for year `y`:
```
scaleFactor(base) = max(scaleFloor, 1 / (1 + scaleSlope * log10(base / scaleRef)))

supportHours(y) = baseSupportHours
                 * timeDecayFactor(y)
                 * scaleFactor(avgInstalledBaseForYear(y))
```
- `timeDecayFactor` is the existing year‑over‑year decay (`supportDecayRate`, `supportFloor`).
- `scaleFactor` introduces economies of scale with a tunable slope and floor.

### Overhead Allocation (perpetual)

```
overheadPerUnit(y) = annualOverhead / avgInstalledBaseForYear(y)
```
- Apply `overheadYear1Factor` (default 0) for Year 1; apply 1.0 for Year 2+.

### Year 1 Cost

```
year1Cost = hardware
          + buildLabor
          + coordination
          + supportHours(1) * hourlyRate
```

### Year 2+ Cost (per year)

```
year2CostForYear(y) = hardwareReserve
                    + supportHours(y) * hourlyRate
```

### Year 2+ Blended Cost (displayed as a single “per-year” rate)

```
year2CostBlended = avg(year2CostForYear(y)) for y = 2..contractYears
overheadBlended  = avg(overheadPerUnit(y))   for y = 2..contractYears
```

### Discounts (commitment incentives)

Keep two layers:
- **Volume discount** based on `commitmentUnits` (incentive to commit).
- **Contract discount** based on `contractYears`.

Year 1 uses a reduced volume discount factor (existing behavior).

Optional safeguard:
- Cap total discount at a configurable max (e.g., 35%) to avoid negative margin.

### Price Formulas

```
// Year 1 (higher initial rate)
baseY1 = year1Cost + (overheadPerUnit(1) * overheadYear1Factor)
priceY1 = baseY1 * (1 + marginY1) * (1 - discountY1)

// Year 2+ (resale rate)
baseY2 = year2CostBlended + overheadBlended
priceY2 = baseY2 * (1 + marginY2Plus) * (1 - discountY2)
```

This structure ensures:
- **Existing fleet rate declines** as installed base grows (overhead/unit down, scale factor down).
- **Commitment incentives** remain via volume + contract discounts.
- **Higher initial rate** is controlled via `marginY1` and optional Year 1 overhead inclusion.

## Configuration Changes

### Add

```
pricing: {
  margins: {
    year1: 0.40,      // higher initial rate
    year2Plus: 0.35,  // resale margin
  },
  overheadYear1Factor: 0.0,   // 0 = exclude overhead from Y1
}

fleet: {
  existingUnits: 0,
}

scaleEfficiency: {
  scaleRefUnits: 100,
  scaleSlope: 0.35,
  scaleFloor: 0.60,
}
```

### Keep/Adjust

- Keep `discounts.volumeTiers` and `contractDiscounts`.
- Keep `labor` and `hardware` sections.
- Keep existing time decay model in `efficiency` (supportDecayRate/supportFloor).

## UI / Inputs

- Add an **Existing Fleet Size** input (slider or field) in both `index.html` and `fx-9d7k2m4p-margin.html`.
- Update explanatory copy: pricing reflects **installed base** and **commitment**.
- Update discount tables to show commitment tiers (not installed base tiers).

## Calibration to Existing Quote Table

Goal: For **full upfront commitment** (commitYears == contractYears, monthlyRate 10–15), total 1/3/5/10‑year prices should be close to:

Pilot (<10): 7000 / 8500 / 9800 / 15000
Growth (10–100): 6100 / 7300 / 8500 / 13000
Scale (200–500): 5200 / 6200 / 7250 / 11000
Enterprise (500+): 4500 / 5300 / 6250 / 9500

Calibration approach:
1. Start with margins (Y1 40%, Y2+ 35%).
2. Adjust `scaleSlope` and `scaleFloor` to capture volume-driven savings.
3. If still off, adjust margins slightly (±5%).
4. Validate that margins remain positive at max discounts.

## Implementation Steps

1. **Config updates**: add margins, scale efficiency, fleet size, overheadYear1Factor.
2. **Pricing model update**:
   - Replace fixed base prices with cost-plus formulas above.
   - Add installed-base calculations and blended year2 cost/overhead.
   - Add scale efficiency in support hours calculation.
3. **UI updates**:
   - Add Existing Fleet Size control and integrate into calculations.
   - Update discount/price explanations.
4. **Docs update**: update README formulas and examples.
5. **Calibration pass** against the quote table.

## Verification

- Changing **existingFleetUnits** lowers Year 2+ price.
- Increasing **monthlyRate** lowers overhead/unit and increases discounts.
- Support hours decrease as fleet grows (scale) and over time (decay).
- Year 1 stays higher than Year 2+ by design.
- Full-commitment outputs are roughly congruent with the quote table.
