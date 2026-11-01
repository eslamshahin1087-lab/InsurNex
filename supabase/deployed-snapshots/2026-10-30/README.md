# Deployed Edge Function Source Snapshots — 2026-10-30

**ARCHIVE ONLY — NEVER DEPLOY FROM THIS DIRECTORY.**

These files are read-only source snapshots returned by the Supabase project metadata tool on 2026-10-30 for project `piloiwtdbtmfiyqxfbae`. They capture the active deployed versions so source drift can be reviewed and corrected in version control.

## Safety boundary

- These snapshots are **not canonical deployment sources**.
- Do not run `supabase functions deploy` from this directory.
- Do not copy a snapshot over `supabase/functions/<slug>` without a separate security review and staging acceptance.
- No Edge Function was deployed, invoked with customer data, paused, reconfigured, or given new secrets while collecting these snapshots.
- No private key, literal API key, Supabase secret key, or JWT token was found in the captured source files. Environment-variable names and legacy authorization patterns are intentionally preserved for review.
- Per-file Git blob SHA values in `manifest.json` verify archived bytes. The provider's `deployedBundleSha256` is metadata and is not assumed to equal an individual source-file hash.

## Captured functions

| Function | Deployed version | Gateway JWT verification | Main observation |
|---|---:|---|---|
| `copilot-chat` | 37 | enabled | Caller-supplied business context; does not match current trusted-context source |
| `document-storage` | 22 | disabled | Older inline implementation; does not match current modular repository source |
| `securepath-webhook` | 20 | disabled | Previously missing from Git; SecurePath integration source recovered |
| `cron-policy-check` | 7 | disabled | Accepts the Supabase service-role key as an alternate cron bearer |
| `cron-document-check` | 7 | disabled | Same service-role bearer fallback; no stable notification deduplication key found |

See `manifest.json` for capture-time metadata and canonical-source comparison. Run `npm run audit:runtime-provenance` to produce a deterministic report with per-file Git blob SHA-1 and SHA-256 computed from the committed archive bytes. This repository comparison is not a live deployment check. The provider did not return a configuration revision in the original read-only capture; that field is explicitly `null`, not inferred. See [Phase 1 Runtime Compatibility](../../../docs/PHASE_1_RUNTIME_COMPATIBILITY_2026-10-30.md) for acceptance gates.
