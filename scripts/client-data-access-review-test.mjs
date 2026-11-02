import assert from 'node:assert/strict';
import { privacySafeReview } from './client-data-access-review-policy.mjs';
import { auditClientDataAccessFiles } from './client-data-access-audit.mjs';

const fixture = [{
  path: 'src/features/clients/example.service.ts',
  content: "const ref = collection(db, 'clients'); getDocs(ref); const value = { nationalId: 'DO_NOT_EMIT' };",
}];
const report = privacySafeReview(auditClientDataAccessFiles(fixture), '2026-11-02T00:00:00.000Z');
assert.equal(report.mode, 'privacy-safe-client-data-callsite-review');
assert.equal(report.summary.relevantFiles, 1);
assert.equal(report.reviewedFiles[0].classification, 'read_candidate');
assert.equal(report.reviewedFiles[0].reviewStatus, 'requires_human_review');
assert.equal(report.reviewPolicy.automaticApproval, false);
assert.equal(report.reviewPolicy.migrationSafe, false);
assert.equal(report.reviewPolicy.proposedSensitiveCollectionsRemainDefaultDenied, true);
assert.equal(JSON.stringify(report).includes('DO_NOT_EMIT'), false);
assert.equal(JSON.stringify(report).includes('nationalId'), true);
assert.ok(report.reviewedFiles[0].lineSignals.some(x => x.signals.includes('clients_collection_reference')));
assert.throws(() => privacySafeReview({ mode: 'wrong', findings: [] }), /INVALID_CLIENT_DATA_ACCESS_AUDIT_REPORT/);
console.log('Client data-access review report tests passed.');
