InsurNex Operations V6 Issuance Semantic Fix Suite
Business rule correction:
- policy_issuance is an issuance REQUEST, not an existing Policy.
- New issuance requests require Client + Insurer but do not select/store an existing policyId or policyNumber.
- Endorsement, Cancellation, Collection and Commission remain linked to an existing Policy and require policy selection.
- Changing operation kind to policy_issuance clears any previously selected policy.
- Operations Inbox visually marks unissued requests as requests, not policies.
- Policy link only appears when the operation truly has a policyId.
- Existing V5 workflow, activity timeline, SLA, Client 360 and data integrations are preserved.
