# P1-C — Legacy Anthropic Medical AI Default-Deny Gate

**Date:** 2026-11-08  
**Branch:** `fix/phase1-disable-legacy-paid-medical-ai-20261108`

## Finding

The exported Firebase callable `medicalClaudeAnalysis` directly sends caller-supplied medical utilization context to Anthropic Claude. Unlike the active Gemini medical UI path, which already requires two build-time approvals and is disabled by default, the legacy callable had no equivalent runtime opt-in or provider-terms gate.

The repository also explicitly retains a zero-paid-AI operating constraint. The unguarded callable was therefore inconsistent with the approved product/runtime posture.

## Change

- Add `LEGACY_MEDICAL_CLAUDE_ENABLED`, defaulting to `false`.
- Add an independent `ANTHROPIC_MEDICAL_TERMS_APPROVED`, also defaulting to `false`.
- Reject the callable with a generic `failed-precondition` before reading the Anthropic API key, validating/transmitting the payload, or constructing the Anthropic client unless both flags are explicitly `true`.
- Extend the existing medical-AI privacy regression test to cover both default-deny flags and verify the guard precedes provider construction.

## Behavior

- Deterministic local medical analytics and local PDF export remain unchanged.
- The active Gemini medical UI retains its existing two-flag default-deny policy.
- The legacy callable remains exported for compatibility, but is inert by default.
- No feature flag, secret value or provider setting is enabled by this change.

## Safety and limitation

This is a source-level guard, not proof about an already deployed Firebase Function. Firebase Cloud Functions deployment remains blocked under the selected Spark plan. No deployment, secret read/write, provider call, customer medical record, billing or project configuration was accessed or changed.

A future activation would require a separate security review of trusted actor authorization, sensitive-data grant and audit requirements, provider terms, explicit paid-budget approval, synthetic tests and a separately approved runtime environment. This PR does not provide that activation path.
