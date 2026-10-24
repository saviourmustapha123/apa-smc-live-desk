import { readFile, access } from 'node:fs/promises';

const checks = [];
const pass = (name, detail = '') => checks.push({ name, ok: true, detail });
const fail = (name, detail = '') => checks.push({ name, ok: false, detail });
const read = async path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const exists = async path => { try { await access(new URL('../' + path, import.meta.url)); return true; } catch { return false; } };

let app = '';
try { app = await read('index.html'); pass('Main application source readable'); }
catch (error) { fail('Main application source readable', error.message); }

if (app) {
  const requireText = (name, regex, detail) => regex.test(app) ? pass(name, detail) : fail(name, detail || 'Required guard or UI marker was not found');
  requireText('Minimum 1:3 reward-to-risk guard', /rr\s*<\s*3/i, 'Rejects candidates below 3R');
  requireText('Provisional strategy status is explicit', /PROVISIONAL-HEURISTIC/, 'Does not label the current engine as fully verified');
  requireText('Signal monitor renderer exists', /function\s+renderSignalMonitor\s*\(/, 'Lifecycle monitor is present');
  requireText('Untriggered lifecycle is represented', /Untriggered/i, 'Pending signals have a distinct state');
  requireText('Missed lifecycle is represented', /Missed/i, 'Unentered opportunities have a distinct state');
  requireText('Successful and unsuccessful performance categories exist', /Successful/i.test(app) && /unsuccessful/i.test(app) ? /Successful/i : /NEVER_MATCH_THIS/, 'Performance outcomes are separately named');
  requireText('No brokerage order execution code', !/\bplaceOrder\s*\(|apiKeySecret|brokerPassword/i.test(app) ? /APA\s*[·-]\s*SMC/i : /NEVER_MATCH_THIS/, 'This application remains a signal monitor, not an execution bot');
  requireText('IndexedDB signal persistence is present', /createObjectStore\(SIGNALS/.test(app) ? /createObjectStore\(SIGNALS/ : /NEVER_MATCH_THIS/, 'Signal history uses browser persistence');
}

for (const path of [
  'scripts/strategy-core.test.mjs',
  'scripts/smc-detectors.test.mjs',
  'scripts/strategy-discovery.test.mjs',
  'scripts/research-backtest.test.mjs',
  'scripts/app-timeframe-health-check.test.mjs',
  'scripts/signal-lifecycle-regression.test.mjs',
  'scripts/proxy-backtest.mjs',
  'scripts/production-strategy-source-audit.mjs',
  '.github/workflows/background-health-check.yml',
  '.github/workflows/strategy-validation.yml'
]) {
  if (await exists(path)) pass('Required control exists: ' + path);
  else fail('Required control exists: ' + path, 'File missing');
}

const failed = checks.filter(c => !c.ok);
const now = new Date().toISOString();
console.log('APA · SMC Live Desk — Engineering Audit');
console.log('Timestamp (UTC): ' + now);
for (const c of checks) console.log((c.ok ? 'PASS' : 'FAIL') + '  ' + c.name + (c.detail ? ' — ' + c.detail : ''));
console.log(`\nResult: ${checks.length - failed.length}/${checks.length} controls passed; ${failed.length} failed.`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '# Engineering audit',
    '',
    '- Timestamp (UTC): ' + now,
    '- Scope: source-level safety markers and required test/automation files. This is not a live browser acceptance test or proof of trading profitability.',
    '',
    '| Status | Control | Detail |',
    '|---|---|---|',
    ...checks.map(c => `| ${c.ok ? 'PASS' : 'FAIL'} | ${c.name.replaceAll('|', '\\|')} | ${(c.detail || '').replaceAll('|', '\\|')} |`),
    '',
    `**Result:** ${checks.length - failed.length}/${checks.length} controls passed; ${failed.length} failed.`
  ].join('\n');
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}
if (failed.length) process.exitCode = 1;
