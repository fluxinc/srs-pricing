#!/usr/bin/env node
'use strict';

const path = require('path');
const { CONFIG, PRICING } = require(path.join(__dirname, '..', 'pricing.js'));

function parseList(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map(v => Number(v.trim())).filter(v => Number.isFinite(v));
}

function parseNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const args = process.argv.slice(2);
const opts = {
  rates: [10, 15],
  durations: [1, 3, 5, 10],
  contract: 10,
  existing: CONFIG.fleet.existingUnits || 0,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--rates') opts.rates = parseList(args[i + 1], opts.rates);
  if (arg === '--durations') opts.durations = parseList(args[i + 1], opts.durations);
  if (arg === '--contract') opts.contract = parseNumber(args[i + 1], opts.contract);
  if (arg === '--existing') opts.existing = parseNumber(args[i + 1], opts.existing);
}

function fmtCurrency(value) {
  return PRICING.formatCurrency(value);
}

function pct(value) {
  return Math.round(value * 100) + '%';
}

function volumeTier(totalUnits) {
  const tier = PRICING.getVolumeTier(totalUnits);
  if (tier.minUnits === 0) return '0-119';
  if (tier.minUnits === 120) return '120-239';
  if (tier.minUnits === 240) return '240-359';
  if (tier.minUnits === 360) return '360-499';
  if (tier.minUnits === 500) return '500+';
  return tier.minUnits + '+';
}

console.log('Installed-Base Pricing Calibration');
console.log('contractYears=', opts.contract, 'existingFleet=', opts.existing);
console.log('margins:', CONFIG.pricing.margins, 'overheadY1Factor=', CONFIG.pricing.overheadYear1Factor);
console.log('scaleEfficiency:', CONFIG.scaleEfficiency);
console.log('');
console.log('rate/mo | commitYrs | units | tier | listY1 | listY2 | y1 | y2 | total');
console.log('--------|-----------|-------|------|--------|--------|----|----|------');

opts.rates.forEach(rate => {
  opts.durations.forEach(duration => {
    const units = PRICING.totalCommitment(rate, duration);
    const listY1 = PRICING.year1ListPrice(rate, duration, opts.contract, opts.existing);
    const listY2 = PRICING.year2ListPrice(rate, duration, opts.contract, opts.existing);
    const y1 = PRICING.year1Price(rate, duration, opts.contract, opts.existing);
    const y2 = PRICING.year2Price(rate, duration, opts.contract, opts.existing);
    const total = PRICING.contractPrice(rate, duration, opts.contract, opts.existing);
    const tier = volumeTier(units);

    const row = [
      String(rate).padStart(6),
      String(duration).padStart(9),
      String(units).padStart(5),
      tier.padStart(4),
      fmtCurrency(listY1).padStart(7),
      fmtCurrency(listY2).padStart(7),
      fmtCurrency(y1).padStart(4),
      fmtCurrency(y2).padStart(4),
      fmtCurrency(total).padStart(6),
    ];
    console.log(row.join(' | '));
  });
});

console.log('');
const fullCommitDiscount = PRICING.contractDiscount(opts.contract);
console.log('Contract discount (' + opts.contract + 'yr):', pct(fullCommitDiscount));
