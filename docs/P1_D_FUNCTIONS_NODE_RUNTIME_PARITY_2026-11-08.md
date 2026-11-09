# P1-D — Firebase Functions Node Runtime Parity

**Date:** 2026-11-08  
**Branch:** `fix/phase1-functions-node-runtime-parity-20261108`

## Finding

The repository root CI used Node.js 22, while `functions/package.json` and its lockfile declared Node.js 20. The Functions TypeScript build therefore ran under Node 22 but advertised a different target runtime to Firebase tooling.

## Change

- Align `functions/package.json` and the root package-lock metadata with Node.js 22.
- Extend the Spark deployment guard test to verify the Functions package, lockfile and CI all agree on Node.js 22.
- Retain the explicit Spark deployment block. This change affects source/runtime metadata and CI only; it does not make Cloud Functions deployment available on the approved Spark plan.

## Compatibility basis

Firebase's current Cloud Functions documentation lists Node.js 20 and 22 as supported runtimes and describes changing the Functions package `engines.node` value to select one. It separately requires the Blaze plan for Cloud Functions deployment. This repository selects Node.js 22 to match its already-established CI runtime; no deployment is attempted.

## Safety

- No Firebase project, function deployment, secrets, provider configuration, billing or customer data was accessed or changed.
- The Spark deployment guard remains active and is tested.
- No dependency versions or application endpoints were changed.

## Validation

CI must pass the Spark runtime guard test, Functions TypeScript build, root lint/build, Deno checks and the Firestore Emulator suite on `demo-insurnex`.
