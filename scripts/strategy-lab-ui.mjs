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
