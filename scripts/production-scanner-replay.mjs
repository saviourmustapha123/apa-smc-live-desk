import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(app);
  if (!match) throw new Error('Production function not found: ' + name);
  const start = match.index;
  const open = app.indexOf('{', match.index);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < app.length; i++) {
    const c = app[i], next = app[i + 1];
    if (lineComment) { if (c === '\\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\\\') escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Unclosed production function: ' + name);
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
  const source = functionNames.map(extractFunction).join('\\n') +
    '\\nconst strategyScanDiagnostics = new Map();' +
    '\\nthis.__scan = scanOpportunityHistory;' +
    '\\nthis.__diagnostics = () => strategyScanDiagnostics;';
  new Script(source, { filename: 'production-scanner-replay.vm.js' }).runInContext(context);
  return {
    scan(symbol, tf, bars) {
      const signals = context.__scan(symbol, tf, bars);
      const diagnostic = context.__diagnostics().get(symbol + '|' + tf) || null;
      return { signals, diagnostic };
    }
  };
}
