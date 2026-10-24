import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = app.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Production function not found: ' + name);
  const next = app.indexOf('\nfunction ', start + 10);
  if (next < 0) throw new Error('Could not find the end boundary for production function: ' + name);
  return app.slice(start, next);
}

const functionNames = [
  'fxSessionOpenAt', 'marketSessionOpen', 'signalEligibilityReason',
  'pivots', 'atr', 'detectPatternRetest', 'detectRecentBlockRetest',
  'latestInducementProxy', 'structuralTarget', 'signalHorizonForTf',
  'estimateTargetHorizon', 'pendingOrderBlockOpportunity', 'scanOpportunityHistory'
];

export function createProductionScannerReplay({ now = Date.now(), k = 3, displacement = 1 } = {}) {
  class ReplayDate extends Date { static now() { return now; } }
  const context = createContext({
    s: { k, disp: displacement },
    marketHealthBySymbol: new Map(),
    Date: ReplayDate,
    secs: { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '4h':14400, '8h':28800, '12h':43200, '1d':86400, '1W':604800, '1M':2592000, '1Y':31536000 }
  });
  const source = functionNames.map(extractFunction).join('\n') +
    '\nconst strategyScanDiagnostics = new Map();' +
    '\nthis.__scan = scanOpportunityHistory;' +
    '\nthis.__diagnostics = () => strategyScanDiagnostics;';
  new Script(source, { filename: 'production-scanner-replay.vm.js' }).runInContext(context);
  return {
    scan(symbol, tf, bars) {
      const signals = context.__scan(symbol, tf, bars);
      const diagnostic = context.__diagnostics().get(symbol + '|' + tf) || null;
      return { signals, diagnostic };
    }
  };
}
