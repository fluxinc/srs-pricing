/**
 * Flux Mobile SRS Bridge Pricing Model - Fleet Discount Program
 *
 * Pricing structure:
 * - Base prices for Year 1 and Year 2+
 * - Contract length discounts (1/3/5/10 year)
 * - Fleet discounts: Additional discount based on fleet size
 *   - Year 1 volume discount: Based on units ordered
 *   - Year 2+ fleet discount: Based on total deployed fleet
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
  // COMMITMENT DISCOUNT CALCULATIONS (rate + duration)
  // ============================================================

  /**
   * Rate discount based on monthly order rate commitment
   * Linear interpolation from minRate to maxRate
   */
  rateDiscount(monthlyRate) {
    const { minRate, maxRate, maxRateDiscount } = CONFIG.discounts;
    if (monthlyRate <= minRate) return 0;
    if (monthlyRate >= maxRate) return maxRateDiscount;
    return ((monthlyRate - minRate) / (maxRate - minRate)) * maxRateDiscount;
  },

  /**
   * Duration discount based on commitment years
   * Linear interpolation from minDuration to maxDuration
   */
  durationDiscount(commitYears) {
    const { minDuration, maxDuration, maxDurationDiscount } = CONFIG.discounts;
    if (commitYears <= minDuration) return 0;
    if (commitYears >= maxDuration) return maxDurationDiscount;
    return ((commitYears - minDuration) / (maxDuration - minDuration)) * maxDurationDiscount;
  },

  /**
   * Combined commitment discount (rate + duration)
   */
  commitmentDiscount(monthlyRate, commitYears) {
    return this.rateDiscount(monthlyRate) + this.durationDiscount(commitYears);
  },

  // ============================================================
  // FLEET DISCOUNT CALCULATIONS
  // ============================================================

  /**
   * Year 1 volume discount (based on units ordered)
   */
  year1VolumeDiscount(unitsOrdered) {
    for (const tier of CONFIG.fleetDiscounts.year1Tiers) {
      if (unitsOrdered >= tier.minUnits) return tier.discount;
    }
    return 0;
  },

  /**
   * Year 2+ fleet discount (based on deployed fleet size)
   */
  year2FleetDiscount(fleetSize) {
    for (const tier of CONFIG.fleetDiscounts.year2Tiers) {
      if (fleetSize >= tier.minUnits) return tier.discount;
    }
    return 0;
  },

  /**
   * Get the current fleet discount tier info
   */
  getFleetTier(fleetSize) {
    for (const tier of CONFIG.fleetDiscounts.year2Tiers) {
      if (fleetSize >= tier.minUnits) {
        return { minUnits: tier.minUnits, discount: tier.discount };
      }
    }
    return { minUnits: 0, discount: 0 };
  },

  /**
   * Get the next fleet discount tier
   */
  getNextFleetTier(fleetSize) {
    const tiers = CONFIG.fleetDiscounts.year2Tiers;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (fleetSize < tiers[i].minUnits) {
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
   * Year 1 price per unit (with all 4 discount layers)
   * Layers: rate + duration + contract (fleet discount does NOT apply to Y1)
   * Commitment discounts apply at reduced rate (year1DiscountFactor)
   */
  year1Price(monthlyRate, commitYears, contractYears) {
    const basePrice = this.year1Base;
    const commitDisc = this.commitmentDiscount(monthlyRate, commitYears) * CONFIG.discounts.year1DiscountFactor;
    const contractDisc = this.contractDiscount(contractYears);
    const totalDisc = commitDisc + contractDisc;
    return this.roundUp50(basePrice * (1 - totalDisc));
  },

  /**
   * Year 1 total discount
   */
  year1TotalDiscount(monthlyRate, commitYears, contractYears) {
    const commitDisc = this.commitmentDiscount(monthlyRate, commitYears) * CONFIG.discounts.year1DiscountFactor;
    return commitDisc + this.contractDiscount(contractYears);
  },

  /**
   * Year 2+ base price per unit per year (no discounts)
   */
  year2BasePrice() {
    return CONFIG.prices.year2;
  },

  /**
   * Year 2+ price per unit per year (with all 4 discount layers)
   * Layers: rate + duration + contract + fleet
   */
  year2Price(monthlyRate, commitYears, contractYears, fleetSize = 0) {
    const basePrice = CONFIG.prices.year2;
    const commitDisc = this.commitmentDiscount(monthlyRate, commitYears);
    const contractDisc = this.contractDiscount(contractYears);
    const fleetDisc = this.year2FleetDiscount(fleetSize);
    const totalDisc = commitDisc + contractDisc + fleetDisc;
    return this.roundUp50(basePrice * (1 - totalDisc));
  },

  /**
   * Year 2+ total discount (all 4 layers)
   */
  year2TotalDiscount(monthlyRate, commitYears, contractYears, fleetSize) {
    return this.commitmentDiscount(monthlyRate, commitYears) +
           this.contractDiscount(contractYears) +
           this.year2FleetDiscount(fleetSize);
  },

  /**
   * Total contract price per unit
   */
  contractPrice(monthlyRate, commitYears, contractYears, fleetSize = 0) {
    const y1 = this.year1Price(monthlyRate, commitYears, contractYears);
    const y2 = this.year2Price(monthlyRate, commitYears, contractYears, fleetSize);
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
  year2Margin(monthlyRate, commitYears, contractYears, fleetSize = 0) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears, fleetSize);
    const cost = this.year2Cost();
    return (price - cost) / price;
  },

  /**
   * Year 2+ margin including amortized overhead
   */
  year2MarginWithOverhead(monthlyRate, commitYears, contractYears, fleetSize) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears, fleetSize);
    const cost = this.year2Cost() + this.overheadPerUnit(fleetSize);
    return (price - cost) / price;
  },

  /**
   * Contract margin
   */
  contractMargin(monthlyRate, commitYears, contractYears, fleetSize = 0) {
    const price = this.contractPrice(monthlyRate, commitYears, contractYears, fleetSize);
    const cost = this.year1Cost() + (this.year2Cost() * Math.max(0, contractYears - 1));
    return (price - cost) / price;
  },

  /**
   * Get total discount breakdown for display
   */
  getDiscountBreakdown(monthlyRate, commitYears, contractYears, fleetSize = 0) {
    return {
      rate: this.rateDiscount(monthlyRate),
      duration: this.durationDiscount(commitYears),
      commitment: this.commitmentDiscount(monthlyRate, commitYears),
      contract: this.contractDiscount(contractYears),
      fleet: this.year2FleetDiscount(fleetSize),
      totalY1: this.year1TotalDiscount(monthlyRate, commitYears, contractYears),
      totalY2: this.year2TotalDiscount(monthlyRate, commitYears, contractYears, fleetSize),
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
  module.exports = { CONFIG, PRICING };
}
