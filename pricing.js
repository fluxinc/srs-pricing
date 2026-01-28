/**
 * Flux Mobile SRS Bridge Pricing Model - Simplified 2-Layer Discount
 *
 * Pricing structure:
 * - Base prices for Year 1 and Year 2+
 * - Layer 1: Volume commitment (total units = rate × 12 × duration)
 * - Layer 2: Contract length discounts (1/3/5/10 year)
 *
 * Year 1 gets reduced volume discount (50% of full discount)
 * Year 2+ gets full volume discount
 *
 * Part numbers (per unit, by contract length):
 * - FX-SRS-1YR: 1-year contract
 * - FX-SRS-3YR: 3-year contract
 * - FX-SRS-5YR: 5-year contract
 * - FX-SRS-10YR: 10-year contract
 */

const PRICING = {
  // ============================================================
  // COST CALCULATIONS (internal)
  // ============================================================

  get hardwareReserve() {
    return CONFIG.hardware.fluxBox / CONFIG.hardware.replacementCycleYears;
  },

  get baseline5yr() {
    return CONFIG.prices.baseline5yr;
  },

  get year1Base() {
    return CONFIG.prices.baseline5yr - (4 * CONFIG.prices.year2);
  },

  year1Cost() {
    const hardware = CONFIG.hardware.fluxBox;
    const buildLabor = CONFIG.labor.buildHoursPerUnit * CONFIG.labor.hourlyRate;
    const year1Support = CONFIG.labor.supportHoursPerUnitYear * CONFIG.labor.hourlyRate;
    const coordination = CONFIG.labor.coordinationHoursPerUnitYear * CONFIG.labor.hourlyRate;
    return hardware + buildLabor + year1Support + coordination;
  },

  year2Cost() {
    const supportCost = CONFIG.labor.supportHoursPerUnitYear * CONFIG.labor.hourlyRate;
    return supportCost + this.hardwareReserve;
  },

  /**
   * Support hours for a given year with efficiency scaling
   * Year 1: full hours, then decays each year until floor
   */
  supportHoursForYear(year) {
    const base = CONFIG.labor.supportHoursPerUnitYear;
    const { supportDecayRate, supportFloor } = CONFIG.efficiency;
    const factor = Math.max(supportFloor, Math.pow(supportDecayRate, year - 1));
    return base * factor;
  },

  /**
   * Year 2+ cost for a specific year with efficiency scaling
   */
  year2CostForYear(year) {
    const supportCost = this.supportHoursForYear(year) * CONFIG.labor.hourlyRate;
    return supportCost + this.hardwareReserve;
  },

  /**
   * Blended Year 2+ cost over a contract period (years 2 through contractYears)
   */
  year2CostBlended(contractYears) {
    if (contractYears <= 1) return 0;
    let total = 0;
    for (let yr = 2; yr <= contractYears; yr++) {
      total += this.year2CostForYear(yr);
    }
    return total / (contractYears - 1);
  },

  // ============================================================
  // VOLUME COMMITMENT CALCULATIONS
  // ============================================================

  /**
   * Calculate total commitment (total units = rate × 12 × duration)
   */
  totalCommitment(monthlyRate, commitYears) {
    return monthlyRate * 12 * commitYears;
  },

  /**
   * Volume discount based on total units committed
   */
  volumeDiscount(totalUnits) {
    for (const tier of CONFIG.discounts.volumeTiers) {
      if (totalUnits >= tier.minUnits) return tier.discount;
    }
    return 0;
  },

  /**
   * Get the current volume tier info
   */
  getVolumeTier(totalUnits) {
    for (const tier of CONFIG.discounts.volumeTiers) {
      if (totalUnits >= tier.minUnits) {
        return { minUnits: tier.minUnits, discount: tier.discount };
      }
    }
    return { minUnits: 0, discount: 0 };
  },

  /**
   * Get the next volume tier
   */
  getNextVolumeTier(totalUnits) {
    const tiers = CONFIG.discounts.volumeTiers;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (totalUnits < tiers[i].minUnits) {
        return { minUnits: tiers[i].minUnits, discount: tiers[i].discount };
      }
    }
    return null; // Already at max tier
  },

  /**
   * Contract discount based on per-unit contract length
   */
  contractDiscount(contractYears) {
    return CONFIG.contractDiscounts[contractYears] || 0;
  },

  // ============================================================
  // PRICE CALCULATIONS
  // ============================================================

  /**
   * Year 1 base price per unit (no discounts)
   */
  year1BasePrice() {
    return this.year1Base;
  },

  /**
   * Year 1 price per unit (with 2 discount layers)
   * Layer 1: Volume discount (at reduced rate - year1VolumeFactor)
   * Layer 2: Contract discount (full)
   */
  year1Price(monthlyRate, commitYears, contractYears) {
    const basePrice = this.year1Base;
    const totalUnits = this.totalCommitment(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(totalUnits) * CONFIG.discounts.year1VolumeFactor;
    const contractDisc = this.contractDiscount(contractYears);
    const totalDisc = volumeDisc + contractDisc;
    return this.roundUp50(basePrice * (1 - totalDisc));
  },

  /**
   * Year 1 total discount
   */
  year1TotalDiscount(monthlyRate, commitYears, contractYears) {
    const totalUnits = this.totalCommitment(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(totalUnits) * CONFIG.discounts.year1VolumeFactor;
    return volumeDisc + this.contractDiscount(contractYears);
  },

  /**
   * Year 2+ base price per unit per year (no discounts)
   */
  year2BasePrice() {
    return CONFIG.prices.year2;
  },

  /**
   * Year 2+ price per unit per year (with 2 discount layers)
   * Layer 1: Volume discount (full)
   * Layer 2: Contract discount (full)
   */
  year2Price(monthlyRate, commitYears, contractYears) {
    const basePrice = CONFIG.prices.year2;
    const totalUnits = this.totalCommitment(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(totalUnits);
    const contractDisc = this.contractDiscount(contractYears);
    const totalDisc = volumeDisc + contractDisc;
    return this.roundUp50(basePrice * (1 - totalDisc));
  },

  /**
   * Year 2+ total discount (2 layers)
   */
  year2TotalDiscount(monthlyRate, commitYears, contractYears) {
    const totalUnits = this.totalCommitment(monthlyRate, commitYears);
    return this.volumeDiscount(totalUnits) + this.contractDiscount(contractYears);
  },

  /**
   * Total contract price per unit
   */
  contractPrice(monthlyRate, commitYears, contractYears) {
    const y1 = this.year1Price(monthlyRate, commitYears, contractYears);
    const y2 = this.year2Price(monthlyRate, commitYears, contractYears);
    return y1 + (y2 * Math.max(0, contractYears - 1));
  },

  // ============================================================
  // MARGIN CALCULATIONS
  // ============================================================

  /**
   * Annual fixed overhead cost (dev/maintenance FTEs + additional)
   */
  annualOverhead() {
    return (CONFIG.overhead.devMaintenanceFTEs * CONFIG.labor.fteSalary) +
           CONFIG.overhead.additionalAnnualCost;
  },

  /**
   * Overhead cost per unit, amortized across install base
   */
  overheadPerUnit(installBase) {
    if (installBase <= 0) return 0;
    return this.annualOverhead() / installBase;
  },

  /**
   * Year 1 margin
   */
  year1Margin(monthlyRate, commitYears, contractYears) {
    const price = this.year1Price(monthlyRate, commitYears, contractYears);
    const cost = this.year1Cost();
    return (price - cost) / price;
  },

  /**
   * Year 2+ margin
   */
  year2Margin(monthlyRate, commitYears, contractYears) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears);
    const cost = this.year2Cost();
    return (price - cost) / price;
  },

  /**
   * Year 2+ margin including amortized overhead
   */
  year2MarginWithOverhead(monthlyRate, commitYears, contractYears, totalUnits) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears);
    const cost = this.year2Cost() + this.overheadPerUnit(totalUnits);
    return (price - cost) / price;
  },

  /**
   * Contract margin
   */
  contractMargin(monthlyRate, commitYears, contractYears) {
    const price = this.contractPrice(monthlyRate, commitYears, contractYears);
    const cost = this.year1Cost() + (this.year2Cost() * Math.max(0, contractYears - 1));
    return (price - cost) / price;
  },

  /**
   * Get total discount breakdown for display
   */
  getDiscountBreakdown(monthlyRate, commitYears, contractYears) {
    const totalUnits = this.totalCommitment(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(totalUnits);
    return {
      volume: volumeDisc,
      volumeY1: volumeDisc * CONFIG.discounts.year1VolumeFactor,
      contract: this.contractDiscount(contractYears),
      totalY1: this.year1TotalDiscount(monthlyRate, commitYears, contractYears),
      totalY2: this.year2TotalDiscount(monthlyRate, commitYears, contractYears),
      totalUnits: totalUnits,
    };
  },

  // ============================================================
  // UTILITIES
  // ============================================================

  roundUp50(value) {
    return Math.ceil(value / 50) * 50;
  },

  formatCurrency(value) {
    return '$' + this.roundUp50(value).toLocaleString();
  },

  formatPercent(value) {
    return Math.round(value * 100) + '%';
  },
};

if (typeof module !== 'undefined' && module.exports) {
  if (typeof CONFIG === 'undefined') {
    global.CONFIG = require('./config.js');
  }
  module.exports = { CONFIG, PRICING };
}
