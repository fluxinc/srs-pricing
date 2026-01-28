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
  // LABOR COSTS
  // ============================================================
  labor: {
    hourlyRate: 35,                   // Billing rate per hour
    fteSalary: 60000,                 // Annual FTE salary
    fteHoursPerYear: 2000,            // Work hours per FTE (50 weeks × 40 hrs)
    buildHoursPerUnit: 3,             // One-time setup per unit
    supportHoursPerUnitYear: 8,       // Annual support per unit
    coordinationHoursPerUnitYear: 4,  // Annual coordination overhead per unit
  },

  // ============================================================
  // EFFICIENCY SCALING (support hours decrease over time)
  // ============================================================
  efficiency: {
    supportDecayRate: 0.90,       // 10% improvement per year
    supportFloor: 0.625,          // Floor at 62.5% (5 hrs minimum from 8 base)
  },

  // ============================================================
  // FIXED OVERHEAD (regardless of install base)
  // ============================================================
  overhead: {
    devMaintenanceFTEs: 1,          // FTEs for system dev & maintenance
    additionalAnnualCost: 0,          // Other fixed annual costs
  },

  // ============================================================
  // BASE PRICES (no commitment - highest price point)
  // ============================================================
  prices: {
    baseline5yr: 9800,                // 5-year total with no commitment
    year2: 1550,                      // Year 2+ base price per unit per year
    // year1 derived: baseline5yr - (4 × year2)
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
  },

  // ============================================================
  // CONTRACT LENGTH DISCOUNTS
  // ============================================================
  contractDiscounts: {
    1: 0.00,                          // 1-year contract: no discount
    3: 0.03,                          // 3-year contract: 3% off
    5: 0.05,                          // 5-year contract: 5% off
    10: 0.18,                         // 10-year contract: 18% off
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
