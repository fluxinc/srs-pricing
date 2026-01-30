#!/usr/bin/env node

const path = require('path');
const CONFIG = require(path.join(__dirname, '..', 'config.js'));
if (typeof global !== 'undefined') {
  global.CONFIG = CONFIG;
}
const { PRICING } = require(path.join(__dirname, '..', 'pricing.js'));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.replace(/^--/, '');
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      opts[key] = next;
      i += 1;
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function range(min, max, step) {
  const list = [];
  for (let v = min; v <= max; v += step) {
    list.push(v);
  }
  return list;
}

function pct(value) {
  return (value * 100).toFixed(1) + '%';
}

function currency(value) {
  return PRICING.roundUp10(value).toString();
}

function currencySigned(value) {
  const rounded = PRICING.roundUp10(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  return sign + rounded.toString();
}

const opts = parseArgs();
const contractDefault = toNumber(opts.contract, 5);
const fleet = toNumber(opts.fleet, 0);
const rateMin = toNumber(opts.rateMin, 10);
const rateMax = toNumber(opts.rateMax, 15);
const rateStep = toNumber(opts.rateStep, 1);
const durationMin = toNumber(opts.durationMin, 1);
const durationMax = toNumber(opts.durationMax, 3);
const durationStep = toNumber(opts.durationStep, 1);
const showOnlyIssues = opts.issues === true || opts.issues === 'true';
const gridMode = opts.grid === true || opts.grid === 'true';
let showTable = opts.table === true || opts.table === 'true';
const runSeries = opts.series !== false && opts.series !== 'false';
const priceEps = toNumber(opts.priceEps, 0.01);
const discEps = toNumber(opts.discEps, 0.005);

const rates = range(rateMin, rateMax, rateStep);
const durations = range(durationMin, durationMax, durationStep);

function parseContracts(value) {
  if (!value) return null;
  if (value === 'all') {
    return Object.keys(CONFIG.contractDiscounts || {})
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }
  const list = String(value)
    .split(/[,\s]+/)
    .map(Number)
    .filter(Number.isFinite);
  return list.length ? list : null;
}

let contracts = parseContracts(opts.contracts);
if (!contracts && gridMode) {
  contracts = parseContracts('all');
}
if (!contracts) {
  contracts = [contractDefault];
}
if (gridMode && !showTable) {
  showTable = true;
}

const header = [
  'rate',
  'duration',
  'totalUnits',
  'discountUnits',
  'y1Price',
  'y1Disc(display)',
  'y1Disc(effective)',
  'y1Delta',
  'y2Price',
  'y2Disc(display)',
  'y2Disc(effective)',
  'y2Delta',
  'totalPrice'
];

function computeRow(rate, duration, contractYears) {
  const totalUnits = PRICING.totalCommitment(rate, duration);
  const discountUnits = PRICING.discountBasisUnits(rate, duration);
  const discounts = PRICING.getDiscountBreakdown(rate, duration, contractYears, fleet);

  const y1Price = PRICING.year1Price(rate, duration, contractYears, fleet);
  const y2Price = PRICING.year2Price(rate, duration, contractYears, fleet);
  const totalPrice = PRICING.contractPrice(rate, duration, contractYears, fleet);

  const y1List = PRICING.displayListYear1();
  const y1Effective = y1List > 0 ? Math.max(0, 1 - (y1Price / y1List)) : 0;
  const y1Display = y1Effective;

  const y2List = PRICING.displayListYear2(fleet);
  const y2Effective = y2List > 0 ? Math.max(0, 1 - (y2Price / y2List)) : 0;
  const y2Display = y2Effective;

  const y1Delta = 0;
  const y2Delta = 0;

  return {
    rate,
    duration,
    contract: contractYears,
    totalUnits,
    discountUnits,
    y1Price,
    y1Display,
    y1Effective,
    y1Delta,
    y2Price,
    y2Display,
    y2Effective,
    y2Delta,
    totalPrice,
    annualAvg: contractYears > 0 ? (totalPrice / contractYears) : totalPrice,
    discounts,
  };
}

function hasIssue(row) {
  const y1Gap = Math.abs(row.y1Delta) >= 0.005;
  const y2Gap = Math.abs(row.y2Delta) >= 0.005;
  return y1Gap || y2Gap;
}

const rows = [];
for (const contractYears of contracts) {
  for (const duration of durations) {
    for (const rate of rates) {
      const row = computeRow(rate, duration, contractYears);
      if (!showOnlyIssues || hasIssue(row)) rows.push(row);
    }
  }
}

console.log(`# contract=${contracts.join(',')} fleet=${fleet} rate=${rateMin}-${rateMax} step=${rateStep} duration=${durationMin}-${durationMax}`);

if (showTable) {
  const headerWithContract = ['contract'].concat(header);
  console.log(headerWithContract.join('\t'));
  rows.forEach(row => {
    console.log([
      row.contract,
      row.rate,
      row.duration,
      row.totalUnits,
      Math.round(row.discountUnits),
      currency(row.y1Price),
      pct(row.y1Display),
      pct(row.y1Effective),
      pct(row.y1Delta),
      currency(row.y2Price),
      pct(row.y2Display),
      pct(row.y2Effective),
      pct(row.y2Delta),
      currency(row.totalPrice),
    ].join('\t'));
  });
}

function deltaIssues(prev, curr, context) {
  const issues = [];
  const d = {
    discTotal: curr.y2Display - prev.y2Display,
    discVolume: curr.discounts.volume - prev.discounts.volume,
    y1Price: curr.y1Price - prev.y1Price,
    y2Price: curr.y2Price - prev.y2Price,
    totalPrice: curr.totalPrice - prev.totalPrice,
    annualAvg: curr.annualAvg - prev.annualAvg,
    y1Display: curr.y1Display - prev.y1Display,
  };

  if (d.discTotal < -discEps) issues.push('discount_decrease');
  if (d.discVolume < -discEps) issues.push('volume_discount_decrease');
  if (d.y1Price > priceEps) issues.push('y1_price_increase');
  if (d.y2Price > priceEps) issues.push('y2_price_increase');
  if (d.totalPrice > priceEps) issues.push('total_price_increase');
  if (d.annualAvg > priceEps) issues.push('annual_price_increase');

  if (d.discVolume > discEps && Math.abs(d.y1Price) <= priceEps) {
    issues.push('y1_flat_after_volume_increase');
  }
  if (d.discTotal > discEps && Math.abs(d.y2Price) <= priceEps) {
    issues.push('y2_flat_after_discount_increase');
  }
  if (d.discTotal > discEps && Math.abs(d.totalPrice) <= priceEps) {
    issues.push('total_flat_after_discount_increase');
  }
  if (d.y1Display > discEps && Math.abs(d.y1Price) <= priceEps) {
    issues.push('y1_flat_after_display_increase');
  }

  if (!issues.length) return null;
  return { issues, d, prev, curr, context };
}

function formatIssue(issue) {
  const { prev, curr, context, d, issues } = issue;
  const ctx = `${context} ${prev.rate}/${prev.duration} -> ${curr.rate}/${curr.duration}`;
  return [
    `! ${issues.join(', ')} (${ctx})`,
    `  discY2 ${pct(prev.y2Display)} -> ${pct(curr.y2Display)} (Δ ${pct(d.discTotal)})`,
    `  discY1 ${pct(prev.y1Display)} -> ${pct(curr.y1Display)} (Δ ${pct(d.y1Display)})`,
    `  volDisc ${pct(prev.discounts.volume)} -> ${pct(curr.discounts.volume)} (Δ ${pct(d.discVolume)})`,
    `  y2 ${currency(prev.y2Price)} -> ${currency(curr.y2Price)} (Δ ${currencySigned(d.y2Price)})`,
    `  annual ${currency(prev.annualAvg)} -> ${currency(curr.annualAvg)} (Δ ${currencySigned(d.annualAvg)})`,
    `  total ${currency(prev.totalPrice)} -> ${currency(curr.totalPrice)} (Δ ${currencySigned(d.totalPrice)})`,
  ].join('\n');
}

function runSeriesCheck() {
  const issues = [];

  contracts.forEach((contractYears) => {
    // Rate series (per duration)
    durations.forEach((duration) => {
      let prev = null;
      rates.forEach((rate) => {
        const row = computeRow(rate, duration, contractYears);
        if (prev) {
          const issue = deltaIssues(prev, row, `contract ${contractYears} rate (dur ${duration})`);
          if (issue) issues.push(issue);
        }
        prev = row;
      });
    });

    // Duration series (per rate)
    rates.forEach((rate) => {
      let prev = null;
      durations.forEach((duration) => {
        const row = computeRow(rate, duration, contractYears);
        if (prev) {
          const issue = deltaIssues(prev, row, `contract ${contractYears} duration (rate ${rate})`);
          if (issue) issues.push(issue);
        }
        prev = row;
      });
    });
  });

  if (!issues.length) {
    console.log('\n# series check: no issues found');
    return;
  }

  console.log(`\n# series check: ${issues.length} issues`);
  issues.slice(0, 25).forEach(issue => {
    console.log(formatIssue(issue));
  });
  if (issues.length > 25) {
    console.log(`... ${issues.length - 25} more`);
  }
}

if (runSeries) {
  runSeriesCheck();
}
