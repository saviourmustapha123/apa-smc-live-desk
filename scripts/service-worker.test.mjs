import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('service-worker shell cache version tracks the current app release', () => {
  const release = html.match(/<meta\s+name=["']app-release["']\s+content=["']([^"']+)["']/i)?.[1];
  const shell = sw.match(/const SHELL_VERSION = 'apa-smc-shell-(\d{4})-(\d{2})-(\d{2})-(\d{2})';/)?.slice(1);
  assert.ok(release, 'application release marker must exist');
  assert.ok(shell, 'service-worker shell cache version must exist');
  assert.equal(shell.join('.'), release, 'a new app release must invalidate the previous shell cache');
});

test('offline shell pre-caches Learning Studio and its local module', () => {
  assert.match(sw, /SHELL_FILES = \[[^\]]*'\.\/learning-studio\.html'[^\]]*'\.\/scripts\/strategy-lab-ui\.mjs'/);
  assert.ok(sw.includes("'./scripts/strategy-discovery.mjs'"), 'Learning Studio import dependency must also be cached');
});

test('offline Learning Studio navigation falls back to the Learning Studio document, not the main dashboard', () => {
  assert.ok(sw.includes("const isLearningStudio = /\\/learning-studio\\.html$/.test(url.pathname);"));
  assert.match(sw, /if \(isLearningStudio\) return \(await cache\.match\('\.\/learning-studio\.html'\)\) \|\| Response\.error\(\)/);
});

test('HTML navigations are network-first and release checks do not poison the cached shell', () => {
  assert.match(sw, /fetch\(request, \{cache: 'no-store'\}\)/);
  assert.match(sw, /!url\.searchParams\.has\('releaseCheck'\)/);
});
