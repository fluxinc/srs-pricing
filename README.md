# Flux Mobile SRS Bridge Pricing Calculator

Two-part pricing structure for coach manufacturer deals: Year 1 (Sales) + Year 2+ (Service).

## Live Pages

- **Calculator**: https://mostlydev.github.io/srs-pricing/
- **Internal Analysis**: https://mostlydev.github.io/srs-pricing/internal.html

## Self-Hosted (Dokku / Node)

This repo now includes a small Node app with SQLite-backed persistence.

**Routes**
- `/` → customer calculator
- `/margins` → internal margin view
- `/api/state` → persisted config + UI state (GET/PUT)

**Environment**
- `DB_PATH` (optional, defaults to `./data/srs.db`)
- `PORT` (provided by Dokku)

**Run locally**
```bash
npm install
npm start
```

## Implementation vs. Original Requirements

**IMPORTANT:** The implemented pricing model differs significantly from the original FTE-based model documented in `SRS_FTE_PRICING_MODEL.md` (Section 14). The changes were made to simplify the pricing structure and align with customer expectations.

### Original Model (FTE-Based)

The requirement document specified an FTE "hiring cliff" model where:
- Discounts emerge naturally when install base crosses ~125 units
- Below 0.5 FTE threshold: Bill at hourly rate ($60/hr)
- Above threshold: Bill based on FTE salary efficiency
- Year 2+ price varies dynamically: $1,098 (sub-FTE) → $698 (at scale)
- No explicit discount tiers or percentages

### Implemented Model (Installed-Base Cost-Plus)

The current implementation uses cost-plus pricing with installed-base economics:
- **Cost-plus pricing**: Year 1 and Year 2+ are derived from actual costs + margin
- **Installed-base overhead**: Annual overhead is amortized across the installed base every year
- **Scale efficiency**: Support hours per unit fall with larger installed base (and over time)
- **Commitment incentives**: Volume + contract discounts remain in place
- **Year 1 premium**: Configurable higher margin for the sales-funded first year

### Key Differences

| Aspect | Original (FTE Model) | Implemented (Installed-Base Model) |
|--------|---------------------|-------------------------------|
| **Discount mechanism** | FTE efficiency cliff at 125+ units | Volume tiers + contract length |
| **Y2+ pricing** | Dynamic ($1,098 → $698) | Cost-plus with installed-base overhead |
| **Discount driver** | Current install base | Blended commitment (rate weighted vs duration) |
| **Part numbers** | FX-SRS-Y1, FX-SRS-Y2 | FX-SRS-1YR, FX-SRS-3YR, etc. |
| **Overhead recovery** | Not specified | Amortized across installed base annually |

### Why the Change?

1. **Cost transparency**: Cost-plus pricing is easy to justify and defend
2. **Installed-base alignment**: Overhead and support scale with the deployed fleet
3. **Commitment incentives**: Volume + contract discounts still reward early commitment
4. **Customer alignment**: Mirrors how sales vs. service funding is structured
5. **Part number clarity**: Contract length in SKU makes quoting easier

See `SRS_FTE_PRICING_MODEL.md` Section 14 for the original FTE-based specification.

### Example: 500 Units Over 4 Years

The installed-base cost-plus model varies by **existing fleet size**, **commitment rate**, and **contract length**. Use the calculator to see the list (cost-plus) price, discount layers, and resulting Year 1 + Year 2+ pricing for a given scenario.

## Pricing Model

### Part Numbers

| Part Number | Description |
|-------------|-------------|
| `FX-SRS-1YR` | 1-year contract |
| `FX-SRS-3YR` | 3-year contract |
| `FX-SRS-5YR` | 5-year contract |
| `FX-SRS-10YR` | 10-year contract |

### Price Structure

- **Year 1**: Fixed base price (volume discount only) + license price on top
- **Year 2+**: Support (scaled) + Hardware Reserve + installed-base overhead (license price added on top)

### Two-Layer Discount Model

**Layer 1: Volume Commitment** (based on blended units: annual rate + duration-weighted add-on)
- 500+ units: 25% off
- 360-499 units: 20% off
- 240-359 units: 15% off
- 120-239 units: 10% off
- 0-119 units: 0% off
- Year 1 gets **50%** of volume discount
- Year 2+ gets **full** volume discount

**Layer 2: Contract Length** (per-unit contract)
- 1-year: 0% off
- 3-year: 2% off
- 5-year: 6% off
- 10-year: 7% off
- Applies to Year 2+ pricing (Year 1 uses volume discount only)

## Configuration

Edit `config.js` to adjust pricing parameters. Key settings:

```javascript
CONFIG = {
  hardware: {
    fluxBox: 950,               // Hardware cost per unit
    replacementCycleYears: 5,   // Hardware reserve calculation
  },

  labor: {
    hourlyRate: 75,             // Billing rate
    buildHoursPerUnit: 4,       // One-time build labor
    supportHoursPerUnitYear: 8, // Annual support hours
    coordinationHoursPerUnit: 4,  // One-time coordination
  },

  licensing: {
    year1List: 1900,            // First-year license list price (revenue)
    year2List: 190,             // Annual license list price (revenue)
    year1Discount: 0.0,         // First-year license discount
    year2Discount: 0.0,         // Year 2+ license maintenance discount
  },

  pricing: {
    year1FixedPrice: 2400,      // Fixed Year 1 base price (excl. license)
    year1ShiftFactor: 0.0,      // Share of Y1 base shifted into later years
    listPriceYear1: 4300,       // Fixed list price used for discount labels
    listPriceYear2: 1600,       // Fixed list price used for discount labels
    margins: {
      year2Plus: 0.20,          // Resale margin
    },
    overheadYear1Factor: 0.0,   // 0 = exclude overhead in Y1
    overheadCreditEnabled: false, // Allow Y1 surplus to offset Y2+ overhead
    overheadCreditYears: 4,     // Cap Y1 surplus amortization across Y2+ years
    year2BaselineYears: 10,     // Longest term used to set Y2+ minimum price
    year2MinGap: 20,            // Minimum Y2+ per-year gap between contract lengths
  },

  scaleEfficiency: {
    scaleRefUnits: 100,
    scaleSlope: 0.35,
    scaleFloor: 0.60,
  },

  fleet: {
    existingUnits: 0,            // Already deployed units
  },

  discounts: {
    volumeTiers: [               // Volume commitment curve control points
      { minUnits: 500, discount: 0.25 },  // 25% off
      { minUnits: 360, discount: 0.20 },  // 20% off
      { minUnits: 240, discount: 0.15 },  // 15% off
      { minUnits: 120, discount: 0.10 },  // 10% off
    ],
    year1VolumeFactor: 0.5,      // Y1 gets 50% of volume discount
    volumeDurationWeight: 0.25,  // Blend annual units vs total commitment
  },

  contractDiscounts: {           // Contract length discounts
    1: 0.00,                     // 1-year: 0%
    3: 0.02,                     // 3-year: 2%
    5: 0.06,                     // 5-year: 6%
    10: 0.07,                    // 10-year: 7%
  },
}
```

See `config.js` for full configuration options.

## Files

| File             | Purpose                         |
|------------------|---------------------------------|
| `index.html`     | Customer-facing calculator      |
| `margins.html`   | Internal margin analysis        |
| `config.js`      | All configurable parameters     |
| `pricing.js`     | Pricing logic and formulas      |

## Cost Formulas

```javascript
// Year 1 Cost
hardware + (buildHours × hourlyRate) + (supportHoursScaled × hourlyRate) + (coordHours × hourlyRate)

// Year 2+ Cost
(supportHoursScaled × hourlyRate) + (hardware / replacementCycleYears)

// Overhead per unit (per year)
(devMaintenanceFTEs × fteSalary) / avgInstalledBase
```

## Implementation Details (pricing.js)

### Volume Discount Calculation

Blended units drive volume tier:

```javascript
annualUnits = monthlyRate × 12
discountUnits = annualUnits × (1 - weight) + (annualUnits × commitYears × weight)

volumeDiscount(totalUnits):
  tiers = sorted by minUnits, with an implicit 0 units / 0% point
  find the two surrounding tiers (lower, upper)
  t = (units - lower.minUnits) / (upper.minUnits - lower.minUnits)
  discount = lower.discount + t × (upper.discount - lower.discount)
  (clamped at 0%..100%, capped at the highest tier)
```

### Price Calculations

**Year 1 Price**:

```javascript
listY1 = year1FixedPrice
discountY1 = volumeDiscount × year1VolumeFactor
baseY1 = roundUp10(listY1 * (1 - discountY1))
shiftY1 = baseY1 * year1ShiftFactor
year1Price = roundUp10((baseY1 - shiftY1) + licenseY1)
```

**Year 2+ Price**:

```javascript
minNetY2 = (avgYear2CostBaseline + avgOverheadBaseline) * (1 + marginY2Plus)
listY2 = minNetY2 / (1 - contractDiscountBaseline)
discountY2 = volumeDiscount + contractDiscount
baseY2 = roundUp10(listY2 * (1 - discountY2))
shiftY2 = shiftY1 / (contractYears - 1)
year2Price = roundUp10(baseY2 + licenseY2 + shiftY2)
```

**Total Contract Price**:

```javascript
contractPrice = year1Price + (year2Price × (contractYears - 1))
```

### Margin Calculations (margins.html only)

**Year 1 Margin**:

```javascript
margin = (price - cost - overheadY1) / price
```

**Year 2+ Margin**:

```javascript
margin = (price - cost - overheadAvg) / price
```

Overhead is allocated annually across the installed base; adjust margins and overhead factors in `config.js` to calibrate.
If Year 1 price exceeds Year 1 cost + overhead, the surplus reduces Y2+ overhead, capped by `pricing.overheadCreditYears`.
Y2+ pricing is anchored to the baseline term (`pricing.year2BaselineYears`) so longer contracts are always cheaper per year than shorter ones.
If `pricing.year2MinGap` is set, Year 2+ per-year prices are enforced to be at least that much higher for shorter terms (3 > 5 > 10).

### Rounding

All prices round up to nearest $20:

```javascript
roundUp10(value) = Math.ceil(value / 10) × 10
```
