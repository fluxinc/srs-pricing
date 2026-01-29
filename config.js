/**
 * Flux Mobile SRS Bridge Pricing Configuration
 *
 * Edit these values to adjust pricing assumptions.
 * All prices and costs are in USD.
 */

const CONFIG = {
  // ============================================================
  // HARDWARE COSTS
  // ============================================================
  hardware: {
    fluxBox: 950,                     // Mac Mini + SSD + enclosure
    replacementCycleYears: 5,         // Hardware replacement cycle
  },

  // ============================================================
  // SOFTWARE LICENSING (REVENUE)
  // ============================================================
  licensing: {
    year1: 1900,                      // First-year license price (per unit)
    year2Plus: 290,                   // Annual license price (per unit)
  },

  // ============================================================
  // LABOR COSTS
  // ============================================================
  labor: {
    hourlyRate: 75,                   // Billing rate per hour
    fteSalary: 60000,                 // Annual FTE salary
    fteHoursPerYear: 2000,            // Work hours per FTE (50 weeks × 40 hrs)
    buildHoursPerUnit: 4,             // One-time setup per unit
    supportHoursPerUnitYear: 8,       // Annual support per unit
    coordinationHoursPerUnit: 4,      // One-time coordination per unit
  },

  // ============================================================
  // TIME EFFICIENCY (support hours decrease over time)
  // ============================================================
  efficiency: {
    supportDecayRate: 0.90,       // 10% improvement per year
    supportFloor: 0.625,          // Floor at 62.5% (5 hrs minimum from 8 base)
  },

  // ============================================================
  // SCALE EFFICIENCY (support hours decrease with installed base)
  // ============================================================
  scaleEfficiency: {
    scaleRefUnits: 100,           // Baseline installed base before scale savings
    scaleSlope: 0.35,             // Higher = faster efficiency gains
    scaleFloor: 0.60,             // Min factor applied to support hours
  },

  // ============================================================
  // FIXED OVERHEAD (annual, regardless of install base)
  // ============================================================
  overhead: {
    devMaintenanceFTEs: 1,          // FTEs for system dev & maintenance
    additionalAnnualCost: 0,          // Other fixed annual costs
  },

  // ============================================================
  // PRICING CONTROLS
  // ============================================================
  pricing: {
    year1FixedPrice: 2400,           // Fixed Year 1 base price (before discounts, excl. license)
    year1ShiftFactor: 0.0,           // Share of Y1 base shifted into later years
    margins: {
      year2Plus: 0.20,               // Resale margin
    },
    overheadYear1Factor: 0.0,        // 0 = exclude overhead in Y1, 1 = full overhead
    overheadCreditYears: 4,          // Cap Y1 surplus amortization across Y2+ years
    year2BaselineYears: 10,          // Longest term used to set Y2+ minimum price
    year2MinGap: 20,                 // Minimum Y2+ per-year gap between contract lengths
  },

  // ============================================================
  // VOLUME COMMITMENT DISCOUNTS
  // Based on total units committed = rate × 12 × duration
  // ============================================================
  discounts: {
    // Volume commitment tiers (sorted descending by minUnits)
    volumeTiers: [
      { minUnits: 500, discount: 0.25 },  // 500+ units: 25% off
      { minUnits: 360, discount: 0.20 },  // 360-499 units: 20% off
      { minUnits: 240, discount: 0.15 },  // 240-359 units: 15% off
      { minUnits: 120, discount: 0.10 },  // 120-239 units: 10% off
    ],

    // Year 1 gets reduced volume discount
    year1VolumeFactor: 0.5,           // Y1 gets 50% of the volume discount

    // Blend between annual rate and total commitment for discount basis
    // 0.0 = annual units only, 1.0 = total commitment (rate * years)
    volumeDurationWeight: 0.25,
  },

  // ============================================================
  // CONTRACT LENGTH DISCOUNTS
  // ============================================================
  contractDiscounts: {
    1: 0.00,                          // 1-year contract: no discount
    3: 0.02,                          // 3-year contract: 2% off
    5: 0.06,                          // 5-year contract: 6% off
    10: 0.07,                         // 10-year contract: 7% off
  },

  // ============================================================
  // INSTALLED BASE
  // ============================================================
  fleet: {
    existingUnits: 0,                 // Already deployed units at start
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
