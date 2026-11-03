# Financial intelligence — policy commission ledger

**Status:** implementation branch, pending review and merge  
**Scope:** metric correctness, organization-wide aggregation, and commission-ledger integrity for quote-driven policy issuance.

## Metric contract

All displayed financial amounts are grouped by normalized ISO 4217 currency code. Amounts in different currencies are never added together and no implicit FX conversion is performed.

| Metric | Definition |
|---|---|
| Recorded premium volume | Confirmed revenue rows with type `premium`. This is a volume measure, not broker income. |
| Brokerage revenue | Confirmed revenue rows of type `commission` or `fee`. |
| Outstanding receivables | Non-cancelled revenue rows of type `outstanding`; shown separately from recognized brokerage revenue. |
| Expenses | All recorded expense rows in the currency bucket. |
| Net brokerage income | Brokerage revenue less recorded expenses, calculated per currency. |
| Pending commissions | Commission ledger rows with status `pending`. |
| Received commissions | Commission ledger rows with status `received`; these are recorded as received only after a finance user confirms collection. |

Currency precision follows the ISO currency metadata available to the runtime formatter. Invalid numeric amounts are excluded and counted in data-quality warnings. Missing or unsupported currency codes are grouped under `UNSPECIFIED`; revenue records with an unknown type are excluded from brokerage revenue and surfaced as unclassified.

## Data integrity and write path

When a quote is issued into a policy, the same Firestore transaction writes:
1. The policy sourced from the selected insurer quote.
2. The quote status and RFQ issuance relationship.
3. One policy commission ledger record keyed by the deterministic policy ID.

The Firestore rules validate that the ledger row matches the policy after the transaction, and that the policy matches the issued quote. The document key equals the policy ID, preventing a second commission row for the same policy through the normal write path. The issued ledger's premium, commission rate, commission amount, currency and policy relationship are immutable. A finance-role member may transition a pending row to received with a receipt date; policy-linked rows cannot be deleted.

Legacy/manual commission rows without the `policy_issuance` source marker retain their existing Finance/Owner/Admin workflow.

## Completeness and boundaries

The overview reads organization-scoped revenue, expense and commission records in sequential pages rather than treating the 500-row list limit as the total. The UI shows currency buckets, row counts, last refresh time and warnings for invalid/unclassified records. The detail panels currently retain their existing latest-500 list limit.

This stage does **not** claim bank reconciliation or insurer-statement matching. It does not import insurer statements, reconcile split/partial payments, handle reversals/refunds, withholding tax, FX conversion or automatically post commission-ledger entries into revenue. Those are separate acceptance items for the reconciliation phase. This prevents counting the same commission in both the revenue journal and the commission receivable ledger without a documented reconciliation rule.

## Validation

- Pure metric tests cover currency separation, minor-unit rounding, premium/revenue separation, outstanding receivables and data-quality flags.
- Firestore Emulator tests cover policy/quote/ledger atomic consistency, Finance receipt transitions, immutable commission basis, delete denial and role-scoped read access.
- CI runs the standard application build and the emulator security regression suite.
