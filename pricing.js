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

  year1ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    return CONFIG.pricing.year1FixedPrice;
  },

  year1BasePrice(monthlyRate, commitYears) {
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(discountUnits) * CONFIG.discounts.year1VolumeFactor;
    return this.roundUp50(CONFIG.pricing.year1FixedPrice * (1 - volumeDisc));
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

    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(discountUnits);
    const baselineDisc = volumeDisc + this.contractDiscount(baselineYears);
    const denom = Math.max(0.01, 1 - baselineDisc);
    return minNetPrice / denom;
  },

  year2PriceRaw(monthlyRate, commitYears, contractYears, existingFleetUnits) {
    const listPrice = this.year2ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits);
    const discountUnits = this.discountBasisUnits(monthlyRate, commitYears);
    const volumeDisc = this.volumeDiscount(discountUnits);
    const contractDisc = this.contractDiscount(contractYears);
    const totalDisc = volumeDisc + contractDisc;
    const basePrice = this.roundUp50(listPrice * (1 - totalDisc));
    const license = CONFIG.licensing.year2Plus || 0;
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
    const license = CONFIG.licensing.year1 || 0;
    return this.roundUp50(shiftedPrice + license);
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
      return this.roundUp50(rawPrice);
    }

    const terms = Object.keys(CONFIG.contractDiscounts)
      .map(Number)
      .filter((years) => years > 1)
      .sort((a, b) => a - b);

    if (!terms.includes(contractYears)) {
      return this.roundUp50(rawPrice);
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

    return this.roundUp50(adjustedByTerm[contractYears]);
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
      listY1: this.year1ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits),
      listY2: this.year2ListPrice(monthlyRate, commitYears, contractYears, existingFleetUnits),
    };
  },

  // ============================================================
  // UTILITIES
  // ============================================================

  roundUp50(value) {
    return Math.ceil(value / 20) * 20;
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
