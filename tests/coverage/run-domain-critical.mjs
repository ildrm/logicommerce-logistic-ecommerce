import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL('./domain-critical.json', import.meta.url), 'utf8'),
);

if (
  manifest.version !== 1 ||
  !Array.isArray(manifest.tests) ||
  manifest.tests.length === 0 ||
  !Array.isArray(manifest.sources) ||
  manifest.sources.length === 0
) {
  throw new Error('Invalid domain-critical coverage manifest');
}

const args = [
  `${root}/node_modules/vitest/vitest.mjs`,
  'run',
  ...manifest.tests,
  '--coverage.enabled',
  '--coverage.provider=v8',
  '--coverage.reporter=text',
  '--coverage.reporter=json-summary',
  '--coverage.reportsDirectory=apps/api/coverage-critical',
  ...manifest.sources.map((source) => `--coverage.include=${source}`),
  ...Object.entries(manifest.thresholds).map(
    ([metric, threshold]) => `--coverage.thresholds.${metric}=${threshold}`,
  ),
];

const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
