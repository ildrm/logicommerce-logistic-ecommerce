import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const requiredGates = [
  'providerSandboxCertification',
  'penetrationTest',
  'privacyAndRegulatoryReview',
  'databaseAndObjectRestoreDrill',
  'productionTelemetryAndOnCall',
  'stagingAcceptance',
  'migrationAndRollbackReview',
];

export function validateEvidence(evidence, now = Date.now()) {
  const failures = [];

  if (evidence.version !== 1 || typeof evidence.release !== 'string' || !evidence.release) {
    failures.push('release evidence metadata is invalid');
  }

  for (const name of requiredGates) {
    const gate = evidence.gates?.[name];
    if (!gate) {
      failures.push(`${name}: missing`);
      continue;
    }
    if (gate.status !== 'verified') failures.push(`${name}: status must be verified`);
    if (!/^https:\/\//u.test(gate.evidenceUri ?? '')) {
      failures.push(`${name}: evidenceUri must be an HTTPS reference`);
    }
    const verifiedAt = Date.parse(gate.verifiedAt ?? '');
    if (!Number.isFinite(verifiedAt) || verifiedAt > now) {
      failures.push(`${name}: verifiedAt must be a valid past timestamp`);
    }
    const expiresAt = Date.parse(gate.expiresAt ?? '');
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      failures.push(`${name}: expiresAt must be a future timestamp`);
    }
  }

  return failures;
}

export function checkEvidenceFile(evidencePath) {
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const failures = validateEvidence(evidence);

  if (failures.length > 0) {
    console.error('Production release evidence is incomplete:');
    for (const failure of failures) console.error(`- ${failure}`);
    return false;
  }

  console.log(`Production release evidence verified for ${evidence.release}.`);
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidencePath = process.argv[2] ?? 'release/evidence.json';
  if (!checkEvidenceFile(evidencePath)) process.exitCode = 1;
}
