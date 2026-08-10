import assert from 'node:assert/strict';
import test from 'node:test';

import { validateEvidence } from './check-evidence.mjs';

const now = Date.parse('2026-08-10T12:00:00.000Z');
const gateNames = [
  'providerSandboxCertification',
  'penetrationTest',
  'privacyAndRegulatoryReview',
  'databaseAndObjectRestoreDrill',
  'productionTelemetryAndOnCall',
  'stagingAcceptance',
  'migrationAndRollbackReview',
];

function verifiedEvidence() {
  return {
    version: 1,
    release: 'v0.1.0-rc.1',
    gates: Object.fromEntries(
      gateNames.map((name) => [
        name,
        {
          status: 'verified',
          evidenceUri: `https://evidence.example/${name}`,
          verifiedAt: '2026-08-10T11:00:00.000Z',
          expiresAt: '2026-09-10T12:00:00.000Z',
        },
      ]),
    ),
  };
}

test('accepts complete, current HTTPS evidence', () => {
  assert.deepEqual(validateEvidence(verifiedEvidence(), now), []);
});

test('fails closed for a pending or expired gate', () => {
  const evidence = verifiedEvidence();
  evidence.gates.penetrationTest.status = 'pending';
  evidence.gates.stagingAcceptance.expiresAt = '2026-08-10T11:00:00.000Z';

  assert.deepEqual(validateEvidence(evidence, now), [
    'penetrationTest: status must be verified',
    'stagingAcceptance: expiresAt must be a future timestamp',
  ]);
});
