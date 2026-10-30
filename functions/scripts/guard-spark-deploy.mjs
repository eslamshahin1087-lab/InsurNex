/**
 * Fail-closed guard for the legacy Firebase Functions deployment command.
 *
 * InsurNex's approved baseline is Firebase Spark. Firebase Functions cannot
 * be deployed/updated on Spark. Keep the legacy source buildable for migration
 * and tests, but never let `npm run deploy --prefix functions` silently
 * trigger a Blaze upgrade or a paid deployment.
 *
 * When the product owner approves a billing/runtime change, replace this guard
 * in a separately reviewed infrastructure PR with the newly approved target.
 */
const lines = [
  '[InsurNex] BLOCKED: Firebase Cloud Functions deployment is disabled.',
  'The approved project baseline is Firebase Spark, which does not support deploying or updating Firebase Cloud Functions.',
  'No Firebase CLI command was run. No billing plan was changed.',
  'Use the approved Supabase Edge Function runtime only after source/deployment parity, secrets, authorization, and Staging acceptance are verified.',
  'To change this policy, obtain explicit owner approval for the billing/runtime architecture and update this guard in a reviewed PR.',
];

console.error(lines.join('\n'));
process.exitCode = 1;
