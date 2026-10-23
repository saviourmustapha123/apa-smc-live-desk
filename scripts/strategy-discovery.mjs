/**
 * Bounded, deterministic hypothesis generator for the Strategy Research Lab.
 *
 * It proposes combinations to TEST. It does not claim novelty, profitability,
 * or official APA compliance. Every candidate must pass a separate backtest.
 */

export const RESEARCH_FEATURES = Object.freeze([
  { id: 'liquidity-sweep', label: 'Liquidity sweep + reclaim', source: 'detectLiquiditySweeps', role: 'trigger' },
  { id: 'structure-break', label: 'Close-confirmed BOS / CHoCH', source: 'detectStructureBreaks', role: 'confirmation' },
  { id: 'fair-value-gap', label: 'Three-candle FVG', source: 'detectFairValueGaps', role: 'location' },
  { id: 'order-block', label: 'Order-block candidate', source: 'detectOrderBlockCandidates', role: 'location' }
]);

const DEFAULT_CONFIG = Object.freeze({
  minFeatures: 2,
  maxFeatures: 3,
  minRiskReward: 3,
  maxCandidates: 100,
  requireTrigger: true
});

function combinations(items, size, start = 0, prefix = [], out = []) {
  if (prefix.length === size) {
    out.push([...prefix]);
    return out;
  }
  for (let i = start; i <= items.length - (size - prefix.length); i++) {
    combinations(items, size, i + 1, [...prefix, items[i]], out);
  }
  return out;
}

function stableId(value) {
  // Stable, dependency-free FNV-1a fingerprint for experiment identification,
  // not a cryptographic integrity hash.
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function generateHypotheses(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const features = Array.isArray(options.features) ? options.features : RESEARCH_FEATURES;
  if (!Number.isInteger(config.minFeatures) || !Number.isInteger(config.maxFeatures) ||
      config.minFeatures < 2 || config.maxFeatures < config.minFeatures ||
      config.maxFeatures > features.length || !Number.isInteger(config.maxCandidates) ||
      config.maxCandidates < 1 || !Number.isFinite(config.minRiskReward) ||
      config.minRiskReward < 3) {
    throw new RangeError('Invalid research bounds: require 2+ features, finite RR >= 3, and positive candidate limit.');
  }
  const unique = new Map(features.filter(f => f && typeof f.id === 'string' && f.id)
    .map(f => [f.id, f]));
  const pool = [...unique.values()];
  if (config.maxFeatures > pool.length) throw new RangeError('maxFeatures exceeds available unique features.');

  const proposed = [];
  for (let size = config.minFeatures; size <= config.maxFeatures; size++) {
    for (const selected of combinations(pool, size)) {
      if (config.requireTrigger && !selected.some(f => f.role === 'trigger' || f.role === 'confirmation')) continue;
      const featureIds = selected.map(f => f.id).sort();
      const specification = {
        schemaVersion: 1,
        family: 'APA-SMC heuristic research candidate',
        features: featureIds,
        entryConvention: 'All selected feature conditions must align on closed candles; exact alignment must be implemented by the evaluator.',
        stopConvention: 'Beyond the structural invalidation level; no fixed pip stop assumed.',
        targetConvention: 'Next opposing confirmed structure; candidate is rejected if achievable reward/risk is below the configured minimum.',
        minimumRiskReward: config.minRiskReward,
        costs: 'Must be supplied by the evaluator; no zero-cost profitability claim permitted.',
        status: 'PROPOSED_NOT_TESTED'
      };
      const canonical = JSON.stringify(specification);
      proposed.push({
        id: 'hyp-' + stableId(canonical),
        name: selected.map(f => f.label).join(' + '),
        specification,
        featureDefinitions: selected,
        validationStatus: 'NOT_TESTED',
        performance: null,
        evidence: [],
        warning: 'A proposal only. No backtest evidence or profitability claim exists.'
      });
      if (proposed.length >= config.maxCandidates) return proposed;
    }
  }
  return proposed;
}

export function researchGate(report) {
  const reasons = [];
  if (!report || typeof report !== 'object') return { eligible: false, reasons: ['Missing validation report.'] };
  if (report.dataAudit !== 'PASS') reasons.push('Data audit has not passed.');
  if (report.lookAheadAudit !== 'PASS') reasons.push('Look-ahead audit has not passed.');
  if (report.costModel !== 'PASS') reasons.push('Trading costs and slippage are not validated.');
  if (!Number.isFinite(report.outOfSampleTrades) || report.outOfSampleTrades < 100) reasons.push('Fewer than 100 out-of-sample trades; evidence is insufficient.');
  if (!Number.isFinite(report.outOfSampleExpectancyR) || report.outOfSampleExpectancyR <= 0) reasons.push('Out-of-sample expectancy is not positive.');
  if (!Number.isFinite(report.outOfSampleProfitFactor) || report.outOfSampleProfitFactor <= 1) reasons.push('Out-of-sample profit factor is not above 1.');
  if (!Number.isFinite(report.maxDrawdownR) || report.maxDrawdownR < 0) reasons.push('Maximum drawdown is missing or invalid.');
  if (report.walkForward !== 'PASS') reasons.push('Walk-forward validation has not passed.');
  if (report.untouchedHoldout !== 'PASS') reasons.push('Untouched holdout validation has not passed.');
  if (report.paperForwardTest !== 'PASS') reasons.push('Forward paper test has not passed.');
  if (report.multipleTestingCorrection !== 'PASS') reasons.push('Multiple-testing / overfitting assessment has not passed.');
  return { eligible: reasons.length === 0, reasons };
}
