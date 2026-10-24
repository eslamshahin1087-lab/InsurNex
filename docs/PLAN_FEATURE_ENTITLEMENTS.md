# Subscription Plan Feature Entitlements

## Decision

Subscription plans now have a feature entitlement map keyed by the shared application feature catalog. All built-in plans enable every current feature by default. This preserves the current experience for existing customers and legacy Firestore plan documents.

## Behavior

- Platform Admins configure plan features from **Admin Panel → Pricing**.
- Ordinary users see a feature only when it is enabled both for their subscription plan and in the global platform settings.
- Direct route navigation is checked as well as navigation/menu visibility.
- Existing plans missing the new `features` field normalize to all features enabled; no migration or bulk rewrite is required to keep existing accounts working.
- The existing subscription expiry/suspension gate remains unchanged.
- Tenant isolation and data authorization remain enforced by Firestore rules, not by client-side feature flags.

## Security limitation

The plan feature map currently controls client UI/routes. It must not be treated as a security boundary for raw Firestore access. Firestore rules continue to enforce tenant isolation. If plan entitlements later need to prevent access to underlying data or server operations, those checks must also be implemented in trusted server-side code or rules.

## Validation

Run `npm run test:plans`, `npm run test:access`, `npm run lint`, and `npm run build`. CI also runs the PWA, Functions build, and Firestore emulator security regression checks.
