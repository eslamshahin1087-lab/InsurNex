export function privacySafeReview(report, generatedAt = new Date().toISOString()) {
  if (!report || report.mode !== 'static-client-data-access-audit' || !Array.isArray(report.findings)) {
    throw new TypeError('INVALID_CLIENT_DATA_ACCESS_AUDIT_REPORT');
  }
  const reviewedFiles = report.findings.map(item => ({
    path: item.path,
    classification: item.clientAccessClassification,
    clientCollectionReference: item.clientCollectionReference,
    documentCollectionReference: item.documentCollectionReference,
    readOperations: [...(item.firestoreReadOperations ?? [])],
    writeOperations: [...(item.firestoreWriteOperations ?? [])],
    sensitiveFieldSignals: [...(item.sensitiveFieldSignals ?? [])],
    lineSignals: (item.lineSignals ?? []).map(signal => ({
      line: signal.line,
      signals: [...(signal.signals ?? [])],
    })),
    findings: [...(item.findings ?? [])],
    reviewStatus: 'requires_human_review',
  }));
  return {
    schemaVersion: 1,
    mode: 'privacy-safe-client-data-callsite-review',
    generatedAt,
    sourceScope: ['src', 'functions/src', 'supabase/functions'],
    summary: { ...report.summary },
    reviewedFiles,
    reviewPolicy: {
      automatedClassificationIsHeuristic: true,
      sourceLinesOrCodeSnippetsIncluded: false,
      customerOrEnvironmentValuesIncluded: false,
      automaticApproval: false,
      migrationSafe: false,
      proposedSensitiveCollectionsRemainDefaultDenied: true,
      requiredHumanActions: [
        'Confirm each candidate against its actual call graph and trusted endpoint behavior.',
        'Record false positives and missed aliases before closing the inventory.',
        'Obtain data-owner approval for purpose, lawful basis, retention and role matrix.',
        'Keep all proposed sensitive collections default-denied until collection-specific Rules and Emulator tests are reviewed.',
      ],
    },
  };
}
