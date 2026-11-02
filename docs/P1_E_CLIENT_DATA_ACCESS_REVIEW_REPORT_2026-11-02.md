# P1-E — Privacy-safe call-site review report

This branch adds a deterministic review-report wrapper around the existing static client-data-access inventory.

## Run

```bash
npm run audit:client-data-review
npm run test:client-data-review
```

## Output contract

The report includes source paths, heuristic read/write classifications, field-name identifiers and line numbers only. It does not include source snippets, field values, customer records, document URLs, tokens, environment variables or secrets.

Every finding is explicitly marked `requires_human_review`. The report cannot approve a call site, authorize a role, make a migration safe, or open a collection. The five proposed sensitive collections remain default-denied.

## Limitations

The underlying inventory is file-level heuristic evidence, not AST/call-graph/data-flow proof. Manual review of actual call paths, trusted endpoints, false positives, aliases, data purpose, lawful basis, retention and role capabilities remains mandatory.

No Firestore Rules, indexes, data, Storage objects, secrets, runtime configuration, billing or deployments are changed.
