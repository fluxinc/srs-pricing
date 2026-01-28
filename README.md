# Flux Mobile SRS Bridge Pricing Calculator

Two-part pricing structure for coach manufacturer deals: Year 1 (Sales) + Year 2+ (Service).

## Live Pages

- **Calculator**: https://mostlydev.github.io/srs-pricing/
- **Internal Analysis**: https://mostlydev.github.io/srs-pricing/internal.html

## Pricing Model

### Part Numbers

| Part Number | Description |
|-------------|-------------|
| `FX-SRS-1YR` | 1-year contract |
| `FX-SRS-3YR` | 3-year contract |
| `FX-SRS-5YR` | 5-year contract |
| `FX-SRS-10YR` | 10-year contract |

### Price Structure

- **Year 1**: Hardware + Build Labor + Support + Coordination
- **Year 2+**: Support + Hardware Reserve

Year 1 price is derived: `baseline5yr - (4 × year2)`

### Three Discount Factors

1. **Rate Discount** — Monthly volume commitment (10-25 units/mo)
2. **Duration Discount** — Years committed to purchasing at that rate (1-10 years)
3. **Contract Discount** — Per-unit contract length (1/3/5/10 year)

Contract discount applies:
- Full discount to Year 1
- Discount minus 5 points to Year 2+ (e.g., 10% Y1 → 5% Y2+)

## Configuration

Edit `config.js` to adjust:

```javascript
CONFIG = {
  hardware: {
    fluxBox: 950,              // Hardware cost per unit
    replacementCycleYears: 5,  // For calculating hardware reserve
  },

  labor: {
    hourlyRate: 35,            // Billing rate
    fteSalary: 60000,          // For FTE calculations
    fteHoursPerYear: 2000,
    buildHoursPerUnit: 3,      // Year 1 only
    supportHoursPerUnitYear: 8,
    coordinationHoursPerUnitYear: 4,  // Year 1 only
  },

  overhead: {
    devMaintenanceFTEs: 1,     // Fixed overhead FTEs
    additionalAnnualCost: 0,
  },

  prices: {
    baseline5yr: 9800,         // 5-year total, no commitment
    year2: 1550,               // Year 2+ base price
  },

  discounts: {
    minRate: 0,                // Baseline (no commitment)
    maxRate: 25,               // Full rate discount at this volume
    maxRateDiscount: 0.25,     // 25% max rate discount

    minDuration: 0,
    maxDuration: 10,
    maxDurationDiscount: 0.15, // 15% max duration discount

    contractDiscounts: {
      1: 0.00,                 // 1-year: no bonus
      3: 0.05,                 // 3-year: +5%
      5: 0.10,                 // 5-year: +10%
      10: 0.15,                // 10-year: +15%
    },

    year1DiscountFactor: 0.5,  // Y1 gets 50% of total discount
  },
}
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Customer-facing calculator |
| `internal.html` | Internal margin analysis |
| `config.js` | All configurable parameters |
| `pricing.js` | Pricing logic and formulas |

## Discount Formulas

Rate and duration use a quadratic ease-out curve:

```
normalized = (value - min) / (max - min)  // clamped 0-1
discount = maxDiscount × (1 - (1 - normalized)²)
```

This gives diminishing returns at higher values.

## Cost Formulas

```javascript
// Year 1 Cost
hardware + (buildHours × hourlyRate) + (supportHours × hourlyRate) + (coordHours × hourlyRate)

// Year 2+ Cost
(supportHours × hourlyRate) + (hardware / replacementCycleYears)

// Overhead per unit (for margin analysis)
(devMaintenanceFTEs × fteSalary) / installBase
```
