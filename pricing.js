/**
 * Flux Mobile SRS Bridge Pricing Model - Installed-Base Cost-Plus
 *
 * Pricing structure:
 * - Cost-plus pricing for Year 1 and Year 2+
 * - Overhead amortized annually across installed base
 * - Support efficiency improves over time and with scale
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
  // COST CALCULATIONS
  // ============================================================

  get hardwareReserve() {
    return CONFIG.hardware.fluxBox / CONFIG.hardware.replacementCycleYears;
  },

  resolveExistingFleet(existingFleetUnits) {
    if (Number.isFinite(existingFleetUnits)) return existingFleetUnits;
    return CONFIG.fleet.existingUnits || 0;
  },

  annualUnits(monthlyRate) {
    return monthlyRate * 12;
  },

  /**
   * Calculate total commitment (total units = rate × 12 × duration)
   */
  totalCommitment(monthlyRate, commitYears) {
    return monthlyRate * 12 * commitYears;
  },

  /**
   * Discount basis units (blended between annual units and total commitment)
   * weight=0 => annual units only, weight=1 => total commitment
   */
  discountBasisUnits(monthlyRate, commitYears) {
    const annualUnits = this.annualUnits(monthlyRate);
    const weight = CONFIG.discounts.volumeDurationWeight ?? 1;
    const clamped = Math.max(0, Math.min(1, weight));
    return (annualUnits * (1 - clamped)) + (annualUnits * commitYears * clamped);
  },

  unitsAddedByYear(year, monthlyRate, commitYears) {
    return this.annualUnits(monthlyRate) * Math.min(year, commitYears);
  },

  /**
   * Average installed base during a given year (linear ramp)
   */
  avgInstalledBaseForYear(year, monthlyRate, commitYears, existingFleetUnits) {
    const existing = this.resolveExistingFleet(existingFleetUnits);
    const annualUnits = this.annualUnits(monthlyRate);
    const unitsAdded = annualUnits * Math.min(year, commitYears);
    let avgBase = existing + unitsAdded;
    if (year <= commitYears) {
      avgBase -= annualUnits / 2;
    }
    return Math.max(existing, avgBase);
  },

  scaleFactor(installBase) {
    const { scaleRefUnits, scaleSlope, scaleFloor } = CONFIG.scaleEfficiency;
    if (installBase <= 0 || installBase <= scaleRefUnits) return 1;
    const factor = 1 / (1 + scaleSlope * Math.log10(installBase / scaleRefUnits));
    return Math.max(scaleFloor, Math.min(1, factor));
  },

  /**
   * Support hours per unit for a given year with time + scale efficiency
   */
  supportHoursForYear(year, monthlyRate, commitYears, existingFleetUnits) {
    const base = CONFIG.labor.supportHoursPerUnitYear;
    const { supportDecayRate, supportFloor } = CONFIG.efficiency;
    const timeFactor = Math.max(supportFloor, Math.pow(supportDecayRate, year - 1));
    const avgBase = this.avgInstalledBaseForYear(year, monthlyRate, commitYears, existingFleetUnits);
    const scaleFactor = this.scaleFactor(avgBase);
    return base * timeFactor * scaleFactor;
  },

  year1Cost(monthlyRate, commitYears, existingFleetUnits) {
    const hardware = CONFIG.hardware.fluxBox;
    const buildLabor = CONFIG.labor.buildHoursPerUnit * CONFIG.labor.hourlyRate;
    const year1Support = this.supportHoursForYear(1, monthlyRate, commitYears, existingFleetUnits) * CONFIG.labor.hourlyRate;
    const coordination = CONFIG.labor.coordinationHoursPerUnit * CONFIG.labor.hourlyRate;
    return hardware + buildLabor + year1Support + coordination;
  },

  year2CostForYear(year, monthlyRate, commitYears, existingFleetUnits) {
    const supportCost = this.supportHoursForYear(year, monthlyRate, commitYears, existingFleetUnits) * CONFIG.labor.hourlyRate;
    return supportCost + this.hardwareReserve;
  },

  year2Cost(monthlyRate, commitYears, existingFleetUnits) {
    return this.year2CostForYear(2, monthlyRate, commitYears, existingFleetUnits);
  },

  /**
   * Blended Year 2+ cost over a contract period (years 2 through contractYears)
   */
  year2CostBlended(contractYears, monthlyRate, commitYears, existingFleetUnits) {
    const effectiveYears = Math.max(2, contractYears);
    let total = 0;
    for (let yr = 2; yr <= effectiveYears; yr++) {
      total += this.year2CostForYear(yr, monthlyRate, commitYears, existingFleetUnits);
    }
    return total / (effectiveYears - 1);
  },

  /**
   * Annual fixed overhead cost (dev/maintenance FTEs + additional)
   */
  annualOverhead() {
    return (CONFIG.overhead.devMaintenanceFTEs * CONFIG.labor.fteSalary) +
           CONFIG.overhead.additionalAnnualCost;
  },

  overheadPerUnitForYear(year, monthlyRate, commitYears, existingFleetUnits) {
    const avgBase = this.avgInstalledBaseForYear(year, monthlyRate, commitYears, existingFleetUnits);
    if (avgBase <= 0) return 0;
    return this.annualOverhead() / avgBase;
  },

  overheadBlendedBase(contractYears, monthlyRate, commitYears, existingFleetUnits) {
    const effectiveYears = Math.max(2, contractYears);
    let total = 0;
    for (let yr = 2; yr <= effectiveYears; yr++) {
      total += this.overheadPerUnitForYear(yr, monthlyRate, commitYears, existingFleetUnits);
    }
    return total / (effectiveYears - 1);
  },

  overheadBlended(contractYears, monthlyRate, commitYears, existingFleetUnits) {
    const base = this.overheadBlendedBase(contractYears, monthlyRate, commitYears, existingFleetUnits);
    if (CONFIG.pricing && CONFIG.pricing.overheadCreditEnabled === false) {
      return base;
    }
    if (contractYears <= 1) return base;
    const y1Price = this.year1Price(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const y1Cost = this.year1Cost(monthlyRate, commitYears, existingFleetUnits);
    const y1Overhead = this.overheadPerUnitForYear(1, monthlyRate, commitYears, existingFleetUnits) * CONFIG.pricing.overheadYear1Factor;
    const surplus = Math.max(0, y1Price - y1Cost - y1Overhead);
    const creditCapRaw = CONFIG.pricing.overheadCreditYears;
    const creditCap = Number.isFinite(creditCapRaw) && creditCapRaw > 0
      ? creditCapRaw
      : (contractYears - 1);
    const creditYears = Math.max(1, Math.min(contractYears - 1, creditCap));
    const creditPerYear = surplus / creditYears;
    return Math.max(0, base - creditPerYear);
  },

  // ============================================================
  // VOLUME COMMITMENT CALCULATIONS
  // ============================================================

  /**
   * Volume discount based on total units committed
   */
  volumeDiscount(totalUnits) {
    const units = Number.isFinite(totalUnits) ? Math.max(0, totalUnits) : 0;
    const tiers = this.normalizeVolumeTiers();
    if (!tiers.length) return 0;

    if (units <= tiers[0].minUnits) {
      return this.clamp01(tiers[0].discount);
    }

    for (let i = 0; i < tiers.length - 1; i++) {
      const lower = tiers[i];
      const upper = tiers[i + 1];
      if (units >= lower.minUnits && units <= upper.minUnits) {
        const span = upper.minUnits - lower.minUnits;
        if (span <= 0) return this.clamp01(upper.discount);
        const t = (units - lower.minUnits) / span;
        const discount = lower.discount + (upper.discount - lower.discount) * t;
        return this.clamp01(discount);
      }
    }

    return this.clamp01(tiers[tiers.length - 1].discount);
  },

  /**
   * Get the current volume tier info
   */
  getVolumeTier(totalUnits) {
    const units = Number.isFinite(totalUnits) ? Math.max(0, totalUnits) : 0;
    const tiers = this.normalizeVolumeTiers();
    if (!tiers.length) return { minUnits: 0, maxUnits: Infinity, discount: 0 };

    for (let i = 0; i < tiers.length - 1; i++) {
      const current = tiers[i];
      const next = tiers[i + 1];
      if (units >= current.minUnits && units < next.minUnits) {
        return {
          minUnits: current.minUnits,
          maxUnits: next.minUnits - 1,
          discount: this.volumeDiscount(units),
        };
      }
    }

    const last = tiers[tiers.length - 1];
    return { minUnits: last.minUnits, maxUnits: Infinity, discount: this.volumeDiscount(units) };
  },

  /**
   * Get the next volume tier
   */
  getNextVolumeTier(totalUnits) {
    const units = Number.isFinite(totalUnits) ? Math.max(0, totalUnits) : 0;
    const tiers = this.normalizeVolumeTiers();
    for (const tier of tiers) {
      if (units < tier.minUnits) {
        return { minUnits: tier.minUnits, discount: tier.discount };
      }
    }
    return null;
  },

  normalizeVolumeTiers() {
    const raw = (CONFIG.discounts && Array.isArray(CONFIG.discounts.volumeTiers))
      ? CONFIG.discounts.volumeTiers
      : [];
    const cleaned = raw
      .map((tier) => {
        const minUnits = Number(tier.minUnits);
        const discount = Number(tier.discount);
        if (!Number.isFinite(minUnits) || !Number.isFinite(discount)) return null;
        return {
          minUnits: Math.max(0, Math.round(minUnits)),
          discount: this.clamp01(discount),
        };
      })
      .filter(Boolean);

    if (!cleaned.some((tier) => tier.minUnits === 0)) {
      cleaned.push({ minUnits: 0, discount: 0 });
    }

    cleaned.sort((a, b) => a.minUnits - b.minUnits);

    const deduped = [];
    for (const tier of cleaned) {
      const last = deduped[deduped.length - 1];
      if (last && last.minUnits === tier.minUnits) {
        last.discount = Math.max(last.discount, tier.discount);
      } else {
        deduped.push({ ...tier });
      }
    }

    let prev = 0;
    for (const tier of deduped) {
      if (tier.discount < prev) tier.discount = prev;
      prev = tier.discount;
    }

    return deduped;
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

  clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  },

  licenseListYear1() {
    const list = (CONFIG.licensing && Number.isFinite(CONFIG.licensing.year1List))
      ? CONFIG.licensing.year1List
      : (CONFIG.licensing && Number.isFinite(CONFIG.licensing.year1) ? CONFIG.licensing.year1 : 0);
    return Number.isFinite(list) ? list : 0;
  },

  licenseListYear2() {
    const list = (CONFIG.licensing && Number.isFinite(CONFIG.licensing.year2List))
      ? CONFIG.licensing.year2List
      : (CONFIG.licensing && Number.isFinite(CONFIG.licensing.year2Plus) ? CONFIG.licensing.year2Plus : 0);
    return Number.isFinite(list) ? list : 0;
  },

  licenseDiscountYear1() {
    return this.clamp01(CONFIG.licensing && Number.isFinite(CONFIG.licensing.year1Discount)
      ? CONFIG.licensing.year1Discount
      : 0);
  },

  licenseDiscountYear2() {
    return this.clamp01(CONFIG.licensing && Number.isFinite(CONFIG.licensing.year2Discount)
      ? CONFIG.licensing.year2Discount
      : 0);
  },

  licensePriceYear1() {
    return this.licenseListYear1() * (1 - this.licenseDiscountYear1());
  },

  licensePriceYear2() {
    return this.licenseListYear2() * (1 - this.licenseDiscountYear2());
  },

  year1ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    return CONFIG.pricing.year1FixedPrice;
  },

  displayListYear1() {
    const list = CONFIG.pricing && Number.isFinite(CONFIG.pricing.listPriceYear1)
      ? CONFIG.pricing.listPriceYear1
      : 0;
    if (list > 0) return list;
    return CONFIG.pricing.year1FixedPrice + this.licenseListYear1();
  },

  displayListYear2(existingFleetUnits) {
    const list = CONFIG.pricing && Number.isFinite(CONFIG.pricing.listPriceYear2)
      ? CONFIG.pricing.listPriceYear2
      : 0;
    if (list > 0) return list;
    return this.year2ListPrice(10, 1, CONFIG.pricing.year2BaselineYears || 10, existingFleetUnits) + this.licenseListYear2();
  },

  year1BasePrice(monthlyRate, commitYears) {
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(discountUnits) * CONFIG.discounts.year1VolumeFactor;
    return this.roundUp10(CONFIG.pricing.year1FixedPrice * (1 - volumeDisc));
  },

  year1ShiftAmount(monthlyRate, commitYears) {
    const base = this.year1BasePrice(monthlyRate, commitYears);
    const factor = CONFIG.pricing.year1ShiftFactor || 0;
    return Math.max(0, Math.min(1, factor)) * base;
  },

  year1ShiftPerYear(monthlyRate, commitYears, contractYears) {
    if (contractYears <= 1) return 0;
    return this.year1ShiftAmount(monthlyRate, commitYears) / (contractYears - 1);
  },

  year2ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const baselineYearsRaw = CONFIG.pricing.year2BaselineYears;
    const baselineYears = Math.max(2, Number.isFinite(baselineYearsRaw) ? baselineYearsRaw : 10);
    const cost = this.year2CostBlended(baselineYears, monthlyRate, commitYears, existingFleetUnits);
    const overhead = this.overheadBlended(baselineYears, monthlyRate, commitYears, existingFleetUnits);
    const minNetPrice = (cost + overhead) * (1 + CONFIG.pricing.margins.year2Plus);

    const baselineDisc = this.contractDiscount(baselineYears);
    const denom = Math.max(0.01, 1 - baselineDisc);
    return minNetPrice / denom;
  },

  year2PriceRaw(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const listPrice = this.year2ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(discountUnits);
    const contractDisc = this.contractDiscount(contractYears);
    const totalDisc = volumeDisc + contractDisc;
    const basePrice = this.roundUp10(listPrice * (1 - totalDisc));
    const license = this.licensePriceYear2();
    const shiftAddOn = this.year1ShiftPerYear(monthlyRate, commitYears, contractYears);
    return basePrice + license + shiftAddOn;
  },

  /**
   * Year 1 price per unit (volume discount only)
   * Volume discount uses the reduced Year 1 factor.
   */
  year1Price(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const basePrice = this.year1BasePrice(monthlyRate, commitYears);
    const shiftAmount = this.year1ShiftAmount(monthlyRate, commitYears);
    const shiftedPrice = Math.max(0, basePrice - shiftAmount);
    const license = this.licensePriceYear1();
    return this.roundUp10(shiftedPrice + license);
  },

  /**
   * Year 1 total discount (volume only)
   */
  year1TotalDiscount(monthlyRate, commitYears, contractYears) {
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    return this.volumeDiscount(discountUnits) * CONFIG.discounts.year1VolumeFactor;
  },

  /**
   * Year 2+ price per unit per year (with 2 discount layers)
   * Layer 1: Volume discount (full)
   * Layer 2: Contract discount (full)
   */
  year2Price(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const minGap = CONFIG.pricing.year2MinGap || 0;
    const rawPrice = this.year2PriceRaw(monthlyRate, commitYears, contractYears, existingFleetUnits);

    if (minGap <= 0) {
      return this.roundUp10(rawPrice);
    }

    const terms = Object.keys(CONFIG.contractDiscounts)
      .map(Number)
      .filter((years) => years > 1)
      .sort((a, b) => a - b);

    if (!terms.includes(contractYears)) {
      return this.roundUp10(rawPrice);
    }

    const rawByTerm = new Map();
    for (const term of terms) {
      rawByTerm.set(term, this.year2PriceRaw(monthlyRate, commitYears, term, existingFleetUnits));
    }

    const adjustedByTerm = {};
    let prevAdjusted = null;
    for (let i = terms.length - 1; i >= 0; i -= 1) {
      const term = terms[i];
      const raw = rawByTerm.get(term);
      const adjusted = prevAdjusted === null ? raw : Math.max(raw, prevAdjusted + minGap);
      adjustedByTerm[term] = adjusted;
      prevAdjusted = adjusted;
    }

    return this.roundUp10(adjustedByTerm[contractYears]);
  },

  /**
   * Year 2+ total discount (2 layers)
   */
  year2TotalDiscount(monthlyRate, commitYears, contractYears) {
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    return this.volumeDiscount(discountUnits) + this.contractDiscount(contractYears);
  },

  /**
   * Total contract price per unit
   */
  contractPrice(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const y1 = this.year1Price(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const y2 = this.year2Price(monthlyRate, commitYears, contractYears, existingFleetUnits);
    return y1 + (y2 * Math.max(0, contractYears - 1));
  },

  // ============================================================
  // MARGIN CALCULATIONS
  // ============================================================

  year1Margin(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const price = this.year1Price(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const cost = this.year1Cost(monthlyRate, commitYears, existingFleetUnits);
    const overhead = this.overheadPerUnitForYear(1, monthlyRate, commitYears, existingFleetUnits) * CONFIG.pricing.overheadYear1Factor;
    return (price - cost - overhead) / price;
  },

  year2Margin(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const cost = this.year2CostBlended(contractYears, monthlyRate, commitYears, existingFleetUnits);
    return (price - cost) / price;
  },

  year2MarginWithOverhead(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const price = this.year2Price(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const cost = this.year2CostBlended(contractYears, monthlyRate, commitYears, existingFleetUnits);
    const overhead = this.overheadBlended(contractYears, monthlyRate, commitYears, existingFleetUnits);
    return (price - cost - overhead) / price;
  },

  contractMargin(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const price = this.contractPrice(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const y1Cost = this.year1Cost(monthlyRate, commitYears, existingFleetUnits);
    const y1Overhead = this.overheadPerUnitForYear(1, monthlyRate, commitYears, existingFleetUnits) * CONFIG.pricing.overheadYear1Factor;
    const y2Cost = this.year2CostBlended(contractYears, monthlyRate, commitYears, existingFleetUnits);
    const y2Overhead = this.overheadBlended(contractYears, monthlyRate, commitYears, existingFleetUnits);
    const years = Math.max(0, contractYears - 1);
    const totalCost = y1Cost + y1Overhead + (years * (y2Cost + y2Overhead));
    return (price - totalCost) / price;
  },

  /**
   * Get total discount breakdown for display
   */
  getDiscountBreakdown(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const totalUnits = this.totalCommitment(monthlyRate, commitYears);
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(discountUnits);
    const overheadY1 = this.overheadPerUnitForYear(1, monthlyRate, commitYears, existingFleetUnits) * CONFIG.pricing.overheadYear1Factor;
    const overheadY2 = this.overheadBlended(contractYears, monthlyRate, commitYears, existingFleetUnits);
    return {
      volume: volumeDisc,
      volumeY1: volumeDisc * CONFIG.discounts.year1VolumeFactor,
      contract: this.contractDiscount(contractYears),
      totalY1: this.year1TotalDiscount(monthlyRate, commitYears, contractYears),
      totalY2: this.year2TotalDiscount(monthlyRate, commitYears, contractYears),
      totalUnits: totalUnits,
      discountUnits: discountUnits,
      overheadY1: overheadY1,
      overheadY2: overheadY2,
      listY1: this.displayListYear1(),
      listY2: this.displayListYear2(existingFleetUnits),
    };
  },

  // ============================================================
  // UTILITIES
  // ============================================================

  roundUp10(value) {
    return Math.ceil(value / 10) * 10;
  },

  formatCurrency(value) {
    return '$' + this.roundUp10(value).toLocaleString();
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
