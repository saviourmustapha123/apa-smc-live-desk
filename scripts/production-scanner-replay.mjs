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
  'pivots', 'atr', 'detectPatternRetest', 'detectRecentBlockRetest',
  'latestInducementProxy', 'targetLevelUnreached', 'structuralTarget',
  'signalHorizonForTf', 'estimateTargetHorizon', 'pendingOrderBlockOpportunity',
  'scanOpportunityHistory', 'realizedSignalR', 'resolveSignalOutcomes', 'evaluateTopDownAlignment', 'summarizeTf', 'volumeContext'
];

export function createProductionScannerReplay({ now = Date.now(), k = 3, displacement = 1 } = {}) {
  class ReplayDate extends Date { static now() { return now; } }
  const context = createContext({
    s: { k, disp: displacement, log: [] },
    save() {},
    persistSignals() {},
    renderLog() {},
    MIN_REWARD_RISK: 3,
    marketHealthBySymbol: new Map(),
    Date: ReplayDate,
    secs: { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '6h':21600, '8h':28800, '12h':43200, '1d':86400, '1W':604800, '1M':2592000, '1Y':31536000 }
  });
  const source = functionNames.map(extractFunction).join('\n') +
    '\nconst strategyScanDiagnostics = new Map();' +
    '\nthis.__scan = scanOpportunityHistory;' +
    '\nthis.__targetLevelUnreached = targetLevelUnreached;' +
    '\nthis.__resolveOutcomes = resolveSignalOutcomes;' +
    '\nconst symbolConfig = {};' +
    '\nconst priceFor = (n, sym) => Number.isFinite(+n) ? (+n).toFixed(5) : "—";' +
    '\nconst stamp = t => new Date(t * 1000).toISOString().replace("T", " ").slice(0, 16);' +
    '\nthis.__align = evaluateTopDownAlignment;' +
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
    },
    evaluateHistoricalAlignment(candidateTf, signal, barsByTf) {
      const duration = { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '6h':21600, '8h':28800, '12h':43200, '1d':86400, '1W':604800, '1M':2678400, '1Y':31622400 };
      const signalTime = Number(signal.time);
      if (!Number.isFinite(signalTime)) return { allowed:false, reason:'Signal timestamp is invalid', checks:[] };
      // Production signals are timestamped with the candidate candle's OPEN time.
      // Evaluate alignment at its close, and only use higher-timeframe candles
      // that were fully closed by that point. This avoids both lookahead and
      // accidentally excluding the still-forming candidate candle's context.
      const candidateCloseTime = signalTime + (duration[candidateTf] || 0);
      const closedAtSignal = {};
      for (const [tf, bars] of Object.entries(barsByTf || {})) {
        const seconds = duration[tf] || 0;
        closedAtSignal[tf] = (bars || []).filter(bar => !bar.isOpen && Number(bar.time) + seconds <= candidateCloseTime);
      }
      return context.__align(candidateTf, signal.side, closedAtSignal, candidateCloseTime * 1000);
    },
    resolveOutcomes(symbol, tf, bars, signals) {
      const results = [];
      for (const signal of signals) {
        context.s.log = [{
          ...signal,
          symbol,
          tf,
          status: signal.status === 'HISTORICAL' ? 'PENDING' : (signal.status || 'PENDING'),
          outcome: 'PENDING'
        }];
        context.__resolveOutcomes(symbol, tf, bars);
        results.push({ ...context.s.log[0] });
      }
      return results;
    }
  };
}
