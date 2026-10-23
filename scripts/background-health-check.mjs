import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const SITE = 'https://saviourmustapha123.github.io/apa-smc-live-desk/';
const SOURCE = 'https://raw.githubusercontent.com/saviourmustapha123/apa-smc-live-desk/main/index.html';
const API = 'https://biquote.io/api';
const failures = [];
const warnings = [];
const pass = (name, detail = '') => console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
const fail = (name, detail = '') => { failures.push(name); console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); };
const warn = (name, detail = '') => { warnings.push(name); console.warn(`WARN  ${name}${detail ? ' — ' + detail : ''}`); };

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'APA-SMC-Live-Desk-health-check/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

let source = '';
try {
  source = await (await get(SOURCE)).text();
  if (source.includes('APA · SMC Live Desk') && source.includes('function analyse()')) pass('Repository source fetched');
  else fail('Repository source content', 'Expected app title or analysis function is missing');

  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(x => x.trim());
  if (!scripts.length) fail('Inline JavaScript found');
  else {
    try { scripts.forEach((code, i) => new vm.Script(code, { filename: `index-inline-${i + 1}.js` })); pass('Inline JavaScript syntax', `${scripts.length} inline script(s) parse successfully`); }
    catch (e) { fail('Inline JavaScript syntax', e.message); }
  }

  const checks = [
    ['minimum 1:3 reward/risk gate', /rr\s*<\s*3/.test(source)],
    ['only supported symbols', /EURUSD/.test(source) && /BTCUSD/.test(source)],
    ['unsafe dynamic content escaping helper', /function escapeHTML\(/.test(source)],
    ['HTTPS-only API allowlist', /function safeApiBase\(/.test(source) && /https:\/\/biquote\.io\/api/.test(source)],
    ['content security policy present', /Content-Security-Policy/.test(source)],
    ['no brokerage execution integration', !/apiKeySecret|brokerPassword|placeOrder\s*\(/i.test(source)]
  ];
  for (const [name, ok] of checks) ok ? pass(name) : fail(name);
} catch (e) { fail('Repository source fetch', e.message); }

try {
  const res = await get(SITE);
  const html = await res.text();
  if (html.includes('APA · SMC Live Desk')) pass('GitHub Pages site responds', `HTTP ${res.status}, ${html.length} bytes`);
  else fail('GitHub Pages site content', 'HTTP success but expected app title not found');
} catch (e) { fail('GitHub Pages site reachability', e.message); }

for (const symbol of ['EURUSD', 'BTCUSD']) {
  try {
    const quote = await (await get(`${API}/${symbol}?allowStale=false`)).json();
    const mid = Number(quote.mid ?? ((Number(quote.bid) + Number(quote.ask)) / 2));
    if (!Number.isFinite(mid) || mid <= 0) fail(`${symbol} live quote shape`, 'Missing positive mid/bid-ask price');
    else {
      if (quote.stale || Number(quote.quoteAgeSeconds) > 300 || quote.marketState === 'closed') warn(`${symbol} quote freshness`, `marketState=${quote.marketState ?? 'unknown'}, age=${quote.quoteAgeSeconds ?? 'unknown'}s`);
      else pass(`${symbol} live quote`, `mid=${mid}, source=${quote.source ?? 'not specified'}`);
    }
  } catch (e) {
    if (symbol === 'EURUSD' && /HTTP 404/.test(e.message)) warn('EURUSD quote freshness', 'Forex market may be closed or quote older than five minutes');
    else fail(`${symbol} live quote endpoint`, e.message);
  }

  try {
    const data = await (await get(`${API}/${symbol}/ohlc?interval=5m&limit=60`)).json();
    const bars = Array.isArray(data) ? data : data.bars ?? data.data ?? data.candles ?? [];
    const valid = bars.filter(b => {
      const o = Number(b.open), h = Number(b.high), l = Number(b.low), c = Number(b.close);
      const raw = b.openTime ?? b.time ?? b.timestamp;
      const t0 = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw)) ? Number(raw) : Date.parse(raw));
      const t = t0 > 1e12 ? t0 / 1000 : t0;
      return Number.isFinite(t) && t > 0 && [o,h,l,c].every(Number.isFinite) && h >= Math.max(o,c,l) && l <= Math.min(o,c,h);
    });
    if (valid.length < 35) fail(`${symbol} OHLC data quality`, `Only ${valid.length} valid bars returned; 35 needed for app analysis`);
    else pass(`${symbol} OHLC data quality`, `${valid.length} valid bars`);
  } catch (e) { fail(`${symbol} OHLC endpoint`, e.message); }
}

console.log(`\nSUMMARY: ${failures.length} failure(s), ${warnings.length} warning(s).`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '# APA · SMC Live Desk background health check',
    '',
    `- Run time (UTC): ${new Date().toISOString()}`,
    `- Failures: **${failures.length}**`,
    `- Warnings: **${warnings.length}**`,
    '',
    'This job checks site availability, feed shape/data quality, JavaScript syntax, and key safety guards. It is **not** a strategy profitability backtest and does not execute or publish trade orders.',
    '',
    failures.length ? '## Failures\n' + failures.map(x => '- ' + x).join('\n') : '## Failures\n- None',
    warnings.length ? '## Warnings\n' + warnings.map(x => '- ' + x).join('\n') : '## Warnings\n- None'
  ].join('\n');
  await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}
if (failures.length) process.exitCode = 1;
