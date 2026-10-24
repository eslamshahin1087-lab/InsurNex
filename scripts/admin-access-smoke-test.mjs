import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [app, guard, adminLogin, rules, settings, subscriptionGate] = await Promise.all([
  read('../src/App.tsx'),
  read('../src/features/admin/AdminGuard.tsx'),
  read('../src/pages/AdminLoginPage.tsx'),
  read('../firestore.rules'),
  read('../src/features/admin/platform-settings.service.ts'),
  read('../src/features/subscription/SubscriptionGate.tsx'),
]);

function check(condition, message) {
  assert.ok(condition, message);
  console.log('PASS ' + message);
}

// Route boundary: admin login is a dedicated route and the panel is nested behind its guard/layout.
check(app.includes('path="/admin-login"'), 'dedicated admin login route exists');
check(app.includes('<Route element={<AdminGuard />}>'), 'admin route group is protected by AdminGuard');
check(app.includes('<Route element={<AdminLayout />}>'), 'admin routes use the separate AdminLayout');
check(app.includes('to="/admin-panel" replace'), 'legacy admin route redirects to the protected panel');

// Admin identity must be checked against the trusted admin membership document.
check(guard.includes('isCurrentUserAdmin(user.uid)'), 'AdminGuard verifies server-backed admin membership');
check(guard.includes("state === 'denied'"), 'AdminGuard denies accounts without admin membership');
check(adminLogin.includes('if (!isAdmin)'), 'admin login rejects a regular user account');
check(adminLogin.includes('await signOut()'), 'admin login signs out a non-admin account');

// Firestore is the security boundary; a client cannot create or elevate admin membership.
check(rules.includes('match /admin/{uid}'), 'dedicated admin membership rules exist');
check(rules.includes('allow create, update, delete: if false;'),
  'Firestore rules prohibit client-side admin membership writes');
check(rules.includes('function isAdmin()'), 'Firestore admin checks use the dedicated admin collection');

// The approved default is full feature availability when platform settings are absent or incomplete.
const featureBlock = settings.match(/features:\s*\{([\s\S]*?)\n\s*\},\n\s*advertising:/);
assert.ok(featureBlock, 'default platform feature settings block exists');
const defaultFeatureEntries = [...featureBlock[1].matchAll(/([a-zA-Z]+):\s*(true|false)/g)];
assert.ok(defaultFeatureEntries.length >= 10, 'default feature list contains the expected application modules');
for (const [, key, value] of defaultFeatureEntries) {
  assert.equal(value, 'true', 'feature "' + key + '" is enabled by default');
}
check(true, 'all platform features are enabled by default');
check(settings.includes('DEFAULT_PLATFORM_SETTINGS.features[feature.key]'),
  'missing individual feature values fall back to the enabled defaults');

// Subscription enforcement is intentionally retained; this is not an admin/user feature toggle.
check(subscriptionGate.includes('isExpired(subscription)'), 'subscription expiry enforcement remains in place');
check(subscriptionGate.includes('to="/subscription"'), 'expired subscriptions are routed to the subscription page');

console.log('Admin/user access smoke tests passed.');
