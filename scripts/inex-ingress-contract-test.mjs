import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = readFileSync(
  new URL('../docs/INEX_APP_LEAD_INGRESS_CONTRACT_V1.md', import.meta.url),
  'utf8',
);
const gates = readFileSync(
  new URL('../docs/SPARK_FREE_TIER_IMPLEMENTATION_GATES_2026-11-01.md', import.meta.url),
  'utf8',
);

const requiredContractSections = [
  'Transport boundary',
  'Request schema',
  'Authentication and anti-replay',
  'Receiver verification',
  'Idempotency and record writes',
  'Required tests before activation',
];
for (const section of requiredContractSections) {
  assert.ok(contract.includes(section), `Missing ingress contract section: ${section}`);
}

for (const invariant of [
  'HMAC-SHA256',
  'constant-time',
  '5 minutes',
  'Idempotency key',
  'cross-tenant',
  'generic',
]) {
  assert.ok(contract.toLowerCase().includes(invariant.toLowerCase()), `Missing security invariant: ${invariant}`);
}

assert.ok(contract.includes('fDGjCCaVCGXbPoH18sMI7DRbpQI2'), 'Requested receiver UID must remain explicit in the proposed contract.');
assert.ok(!contract.includes('Receiver account is verified'), 'The contract must not claim that the receiver account is verified.');
assert.ok(contract.includes('not active') === false, 'The contract must not make claims about the receiver account state.');
assert.ok(gates.includes('Firebase Cloud Functions remain build/test-only legacy source'));
assert.ok(gates.includes('No Firebase Cloud Functions deployment on Spark'));
assert.ok(gates.includes('consumer free-tier generative APIs'));

console.log('iNex ingress contract and Spark safety gates: PASS');
