/**
 * Flux Box Pricing Configuration
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
  // DISCOUNT SETTINGS
  // ============================================================
  discounts: {
    // Rate commitment discount (monthly units)
    // Baseline is 0 (no commitment) - slider starts at 10, which already earns ~13% discount
    minRate: 0,                       // Baseline: no commitment (conceptual)
    maxRate: 20,                      // Maximum for full rate discount
    maxRateDiscount: 0.25,            // 20% max from higher rate

    // Duration commitment discount (years of commitment to purchase)
    // Baseline is 0 (no commitment) - slider starts at 1yr, which earns ~3% discount
    minDuration: 0,                   // Baseline: no commitment (conceptual)
    maxDuration: 10,                  // Maximum for full duration discount
    maxDurationDiscount: 0.18,        // 15% max from longer commitment

    // Contract length discount (per-unit contract term)
    contractDiscounts: {
      1: 0.00,                        // 1-year contract: no additional discount
      3: 0.05,                        // 3-year contract: 5% additional
      5: 0.10,                        // 5-year contract: 10% additional
      10: 0.15,                       // 10-year contract: 15% additional
    },

    // How much Year 1 is discounted (hardware cost limits discount)
    year1DiscountFactor: 0.5,         // Year 1 gets 50% of total discount
  },
};
