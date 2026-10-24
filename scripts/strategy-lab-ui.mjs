import { generateHypotheses } from './strategy-discovery.mjs';

const escapeLabHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

let candidates = [];
const generateButton = document.getElementById('generateHypotheses');

if (generateButton) {
  generateButton.addEventListener('click', () => {
    try {
      candidates = generateHypotheses({ maxCandidates: 100 });
      const rows = candidates.map(item => {
        const spec = item.specification;
        return '<tr><td><b>' + escapeLabHTML(item.name) + '</b><div class="fine">' + escapeLabHTML(item.id) + '</div></td>' +
          '<td>' + escapeLabHTML(spec.entryConvention) + '<div class="fine">Target: ' + escapeLabHTML(spec.targetConvention) + '</div></td>' +
          '<td><div>' + escapeLabHTML(spec.features.join(', ')) + '</div><div class="fine">Minimum R:R ' + escapeLabHTML(spec.minimumRiskReward) + ' · ' + escapeLabHTML(spec.stopConvention) + '</div></td>' +
          '<td><span class="lab-status">PROPOSED · NOT TESTED</span></td><td>Blocked pending backtest, holdout and paper test</td></tr>';
      }).join('');
      document.getElementById('hypothesisRows').innerHTML = rows || '<tr><td colspan="5">No combinations meet the current search bounds.</td></tr>';
      document.getElementById('candidateCount').textContent = candidates.length + ' proposals · 0 validated';
      document.getElementById('generatorStatus').textContent = 'Generated deterministically from ' + candidates.length + ' feature combinations. IDs are reproducible fingerprints, not cryptographic hashes. Proposals have no performance results.';
      recordMonitorEvent('Generated ' + candidates.length + ' research proposals; none has been tested or validated.');
    } catch (error) {
      document.getElementById('generatorStatus').textContent = 'Generator error: ' + error.message;
    }
  });

  document.getElementById('exportHypotheses')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status: 'PROPOSALS_NOT_TESTED',
      candidates
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'apa-smc-research-proposals.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
}


// The monitor reflects observable app state only. It never fabricates a scan,
// trade, validation result, or claim that the page is a persistent background worker.
const monitorEvents = [];
let previousMonitorSnapshot = '';
function recordMonitorEvent(message) {
  monitorEvents.unshift(new Date().toLocaleTimeString() + ' · ' + message);
  monitorEvents.splice(8);
  const list = document.getElementById('intelligenceEventLog');
  if (list) list.innerHTML = monitorEvents.map(item => '<li>' + escapeLabHTML(item) + '</li>').join('');
}
function countDataRows(id) {
  const body = document.getElementById(id);
  if (!body) return null;
  return [...body.querySelectorAll('tr')].filter(row =>
    row.querySelectorAll('td').length > 1 && !row.querySelector('td[colspan]')
  ).length;
}
function refreshIntelligenceMonitor() {
  const monitor = document.getElementById('backgroundIntelligenceMonitor');
  if (!monitor) return;
  const status = document.getElementById('signalEngineStatus')?.textContent?.trim() || '';
  const online = navigator.onLine;
  const state = document.getElementById('intelligenceRunState');
  const scanner = document.getElementById('intelligenceScannerState');
  const scannerDetail = document.getElementById('intelligenceScannerDetail');
  const connection = document.getElementById('intelligenceConnection');
  const connectionDetail = document.getElementById('intelligenceConnectionDetail');
  const counts = document.getElementById('intelligenceSignalCounts');
  const diagnostics = document.getElementById('intelligenceDiagnostics');
  const actionableText = document.getElementById('signalCount')?.textContent?.trim() || 'Not available';
  const activeText = document.getElementById('activeActivityCount')?.textContent?.trim() || 'Not available';
  const monitorStatus = !online ? 'CONNECTION OFFLINE' :
    /failed|error|paused|stale/i.test(status) ? 'NEEDS ATTENTION' :
    /Automatic scan/i.test(status) ? 'SCANNER REPORTING' :
    status ? 'STATUS AVAILABLE' : 'WAITING FOR STATUS';
  if (state) state.textContent = monitorStatus;
  if (scanner) scanner.textContent = status ? status.split(' · ').slice(0, 2).join(' · ') : 'No scanner status reported';
  if (scannerDetail) scannerDetail.textContent = /Automatic scan/i.test(status)
    ? 'The app has reported an automatic scan event. The line below contains its reported outcome.'
    : 'Latest app status: ' + (status || 'not yet reported') + '. This monitor does not assume a scan completed.';
  if (connection) connection.textContent = online ? 'Browser online' : 'Browser offline';
  if (connectionDetail) connectionDetail.textContent = online
    ? 'Network connectivity is available; feed freshness and candle validity still require their own checks.'
    : 'New online market data may be unavailable. Do not treat cached prices as fresh live data.';
  if (counts) counts.textContent = actionableText + ' · ' + activeText;
  const reasons = [];
  if (!online) reasons.push('Network is offline; live feed checks may fail.');
  if (!status) reasons.push('No scanner status has been reported yet.');
  if (/failed|error/i.test(status)) reasons.push('The scanner reports an error. Inspect the app status and feed diagnostics before trusting new signals.');
  if (/stale|awaiting|waiting/i.test(status)) reasons.push('The latest status suggests data or a scan may still be pending; verify candle timestamps.');
  if (/Automatic scan/i.test(status) && !/failed|error/i.test(status)) reasons.push('A scan event is reported, but this monitor does not independently verify strategy correctness or trade profitability.');
  if (!reasons.length) reasons.push('No obvious connection or scanner error is exposed by the current status text. This is not a full strategy audit.');
  if (diagnostics) diagnostics.textContent = reasons.join(' ');
  const snapshot = [monitorStatus, status, online, actionableText, activeText].join('|');
  if (snapshot !== previousMonitorSnapshot) {
    if (previousMonitorSnapshot) recordMonitorEvent(monitorStatus + (status ? ' · ' + status : ''));
    else recordMonitorEvent('Monitor connected to visible app status.');
    previousMonitorSnapshot = snapshot;
  }
}
refreshIntelligenceMonitor();
window.addEventListener('online', refreshIntelligenceMonitor);
window.addEventListener('offline', refreshIntelligenceMonitor);
setInterval(refreshIntelligenceMonitor, 5000);
