import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = app.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Production function not found: ' + name);
  const nextFunction = app.indexOf('\nfunction ', start + 10);
  const nextDiagnosticMap = app.indexOf('\nconst strategyScanDiagnostics', start + 10);
  const candidates = [nextFunction, nextDiagnosticMap].filter(index => index >= 0);
  if (!candidates.length) throw new Error('Could not find the end boundary for production function: ' + name);
  return app.slice(start, Math.min(...candidates));
}

const functionNames = [
  'fxSessionOpenAt', 'marketSessionOpen', 'signalEligibilityReason',
  'pivots', 'atr', 'detectQmlStructure', 'detectPatternRetest', 'detectRecentBlockRetest',
  'latestInducementProxy', 'targetLevelUnreached', 'structuralTarget',
  'signalHorizonForTf', 'estimateTargetHorizon', 'pendingOrderBlockOpportunity',
  'scanOpportunityHistory'
];

export function createProductionScannerReplay({ now = Date.now(), k = 3, displacement = 1 } = {}) {
  class ReplayDate extends Date { static now() { return now; } }
  const context = createContext({
    s: { k, disp: displacement },
    MIN_REWARD_RISK: 3,
    marketHealthBySymbol: new Map(),
    Date: ReplayDate,
    secs: { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '6h':21600, '8h':28800, '12h':43200, '1d':86400, '1W':604800, '1M':2592000, '1Y':31536000 }
  });
  const source = functionNames.map(extractFunction).join('\n') +
    '\nconst strategyScanDiagnostics = new Map();' +
    '\nthis.__scan = scanOpportunityHistory;' +
    '\nthis.__targetLevelUnreached = targetLevelUnreached;' +
    '\nthis.__diagnostics = () => strategyScanDiagnostics;';
  new Script(source, { filename: 'production-scanner-replay.vm.js' }).runInContext(context);
  return {
    scan(symbol, tf, bars) {
      const signals = context.__scan(symbol, tf, bars);
      const diagnostic = context.__diagnostics().get(symbol + '|' + tf) || null;
      return { signals, diagnostic };
    },
    targetLevelUnreached(side, target, bars, targetIndex) {
      return context.__targetLevelUnreached(side, target, bars, targetIndex);
    }
  };
}
