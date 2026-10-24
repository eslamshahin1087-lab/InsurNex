# Admin and User Access Model

## Approved product decisions

- The Platform Admin backend is a distinct protected area for InsurNex platform operators only.
- Ordinary users work in the broker application and receive the complete feature set enabled for their subscription/plan by default. No per-user operational restrictions are introduced by default.
- A user cannot grant themselves Platform Admin access. Admin membership is provisioned outside the client application.
- Tenant isolation remains mandatory: normal users may access business records only for their own organization.
- Subscription status and onboarding checks remain separate from role-based access. A valid role does not bypass tenant isolation or grant access to an expired/suspended subscription.
- Production deploys and merges to `main` require explicit approval.

## Current implementation found in the repository

- The broker application and admin backend share the React application and Firebase Authentication, but use separate route groups and layouts.
- `/admin-login` is the dedicated admin sign-in route; `/admin-panel/*` is protected by `AdminGuard` and rendered through `AdminLayout`. Legacy `/admin/*` routes redirect to the panel.
- Admin authorization is based on the existence of `admin/{uid}`; Firestore rules deny client-side create/update/delete operations on that collection.
- Ordinary broker routes are protected by authentication, profile/setup, subscription status, and platform feature gates.
- Platform feature flags default to enabled when the global settings document or an individual feature value is missing.
- Subscription plans now carry a per-plan feature matrix. Built-in plans and legacy records missing the feature field default to all features enabled; platform-wide feature switches remain separate overrides.

## Important distinction

The approved default is full access to the features enabled for a user's plan, not arbitrary per-user permission toggles. The current repository does not yet define per-plan feature entitlements. Before implementing differentiated feature sets per plan, that schema and its migration/default behavior must be designed explicitly. Do not infer plan restrictions from missing fields, and do not weaken tenant isolation to simplify access.

## Validation gates

1. Source-level access smoke test checks route separation, admin guard usage, Firestore admin-write denial, and default feature availability.
2. Existing CI continues to run lint, TypeScript/Vite build, Functions build, PWA checks, and Firestore emulator security regression tests.
3. Manual acceptance must cover: normal user login, admin login, non-admin denial, active and expired subscription paths, direct URL navigation, and cross-organization data denial.
4. No production deployment is part of this work unless explicitly approved.
