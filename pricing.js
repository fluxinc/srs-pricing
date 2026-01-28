/**
 * Flux Box Pricing Model
 *
 * Three discount factors:
 * 1. Rate discount: Based on monthly order commitment (10-25/mo)
 * 2. Duration discount: Based on commitment to purchase for N years
 * 3. Contract discount: Based on per-unit contract length (1/3/5/10 yr)
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

  // ============================================================
  // DISCOUNT CALCULATIONS
  // ============================================================

  /**
   * Rate discount based on monthly commitment
   */
  rateDiscount(monthlyRate) {
    const { minRate, maxRate, maxRateDiscount } = CONFIG.discounts;
    const normalized = Math.max(0, Math.min(1, (monthlyRate - minRate) / (maxRate - minRate)));
    return maxRateDiscount * (1 - Math.pow(1 - normalized, 2));
  },

  /**
   * Duration discount based on commitment length (years of purchasing)
   */
  durationDiscount(commitYears) {
    const { minDuration, maxDuration, maxDurationDiscount } = CONFIG.discounts;
    const normalized = Math.max(0, Math.min(1, (commitYears - minDuration) / (maxDuration - minDuration)));
    return maxDurationDiscount * (1 - Math.pow(1 - normalized, 2));
  },

  /**
   * Contract discount based on per-unit contract length
   */
  contractDiscount(contractYears) {
    return CONFIG.discounts.contractDiscounts[contractYears] || 0;
  },

  /**
   * Total discount (rate + duration + contract)
   */
  totalDiscount(monthlyRate, commitYears, contractYears) {
    return this.rateDiscount(monthlyRate) +
           this.durationDiscount(commitYears) +
           this.contractDiscount(contractYears);
  },

  // ============================================================
  // PRICE CALCULATIONS
  // ============================================================

  /**
   * Year 1 price per unit
   */
  year1Price(monthlyRate, commitYears, contractYears) {
    const basePrice = this.year1Base;
    const discount = this.totalDiscount(monthlyRate, commitYears, contractYears);
    return this.roundUp50(basePrice * (1 - discount * CONFIG.discounts.year1DiscountFactor));
  },

  /**
   * Year 2+ price per unit per year
   */
  year2Price(monthlyRate, commitYears, contractYears) {
    const basePrice = CONFIG.prices.year2;
    const discount = this.totalDiscount(monthlyRate, commitYears, contractYears);
    return this.roundUp50(basePrice * (1 - discount));
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

  year1Margin(monthlyRate, commitYears, contractYears) {
    const price = this.year1Price(monthlyRate, commitYears, contractYears);
    const cost = this.year1Cost();
    return (price - cost) / price;
  },

  year2Margin(monthlyRate, commitYears, contractYears) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears);
    const cost = this.year2Cost();
    return (price - cost) / price;
  },

  /**
   * Year 2+ margin including amortized overhead
   */
  year2MarginWithOverhead(monthlyRate, commitYears, contractYears, installBase) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears);
    const cost = this.year2Cost() + this.overheadPerUnit(installBase);
    return (price - cost) / price;
  },

  contractMargin(monthlyRate, commitYears, contractYears) {
    const price = this.contractPrice(monthlyRate, commitYears, contractYears);
    const cost = this.year1Cost() + (this.year2Cost() * Math.max(0, contractYears - 1));
    return (price - cost) / price;
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
