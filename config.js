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
  // COMMITMENT DISCOUNTS (rate + duration)
  // ============================================================
  discounts: {
    // Rate commitment (monthly order rate)
    minRate: 0,                       // Minimum rate for discount calculation
    maxRate: 20,                      // Rate at which max discount is reached
    maxRateDiscount: 0.25,            // Max discount from rate commitment (25%)

    // Duration commitment (years of purchasing)
    minDuration: 0,                   // Minimum duration for discount calculation
    maxDuration: 10,                  // Duration at which max discount is reached
    maxDurationDiscount: 0.18,        // Max discount from duration commitment (18%)

    // Year 1 discount factor (commitment discounts apply at reduced rate to Y1)
    year1DiscountFactor: 0.5,         // Y1 gets 50% of the commitment discount
  },

  // ============================================================
  // FLEET DISCOUNT TIERS
  // ============================================================
  fleetDiscounts: {
    // Year 1 volume discount (based on units ordered)
    // Sorted descending by minUnits for lookup efficiency
    year1Tiers: [
      { minUnits: 250, discount: 0.17 },  // 250+ units: 17% off Y1
      { minUnits: 100, discount: 0.11 },  // 100-249 units: 11% off Y1
      { minUnits: 50, discount: 0.06 },   // 50-99 units: 6% off Y1
    ],

    // Year 2+ fleet discount (based on deployed fleet size)
    // Sorted descending by minUnits for lookup efficiency
    year2Tiers: [
      { minUnits: 500, discount: 0.29 },  // 500+ units: 29% off Y2+
      { minUnits: 250, discount: 0.23 },  // 250-499 units: 23% off Y2+
      { minUnits: 100, discount: 0.16 },  // 100-249 units: 16% off Y2+
      { minUnits: 50, discount: 0.10 },   // 50-99 units: 10% off Y2+
    ],
  },

  // ============================================================
  // CONTRACT LENGTH DISCOUNTS
  // ============================================================
  contractDiscounts: {
    1: 0.00,                          // 1-year contract: no discount
    3: 0.05,                          // 3-year contract: 5% off
    5: 0.10,                          // 5-year contract: 10% off
    10: 0.15,                         // 10-year contract: 15% off
  },
};
