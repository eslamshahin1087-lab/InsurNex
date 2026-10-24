import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [catalog, planTypes, planService, pricingConfig, pricingPage, provider, routeGate, appLayout] = await Promise.all([
  read('../src/features/admin/feature-catalog.ts'),
  read('../src/features/admin/plans.types.ts'),
  read('../src/features/admin/plans.service.ts'),
  read('../src/features/admin/pricing.config.ts'),
  read('../src/pages/AdminPricingPage.tsx'),
  read('../src/features/subscription/PlanFeaturesProvider.tsx'),
  read('../src/features/admin/PlatformFeatureGate.tsx'),
  read('../src/layouts/AppLayout.tsx'),
]);

function check(condition, message) {
  assert.ok(condition, message);
  console.log('PASS ' + message);
}

check(catalog.includes('DEFAULT_FEATURE_ENTITLEMENTS'), 'shared default plan entitlements are defined');
check(catalog.includes('PLATFORM_FEATURES.map(({ key }) => [key, true])'), 'all known features default to enabled');
check(catalog.includes('typeof raw[key] === \'boolean\' ? raw[key] : DEFAULT_FEATURE_ENTITLEMENTS[key]'),
  'legacy or incomplete plans fall back to full feature access');
check(planTypes.includes('features: FeatureEntitlements'), 'plan model includes typed feature entitlements');
check(planService.includes('features: normalizeFeatureEntitlements(value.features)'), 'legacy plan documents are normalized on read');
check(planService.includes('features: normalizeFeatureEntitlements(plan.features)'), 'plan features are normalized before persistence');
check((pricingConfig.match(/features: DEFAULT_FEATURE_ENTITLEMENTS/g) || []).length >= 3,
  'all built-in subscription plans enable all features by default');
check(pricingPage.includes('editing.features[feature.key]'), 'admin pricing editor exposes per-plan feature controls');
check(pricingPage.includes('features: editing.features'), 'admin pricing editor saves selected plan features');
check(provider.includes('getPlanById(planId)'), 'active subscription plan features are loaded from the plan record');
check(provider.includes('setFeatures(DEFAULT_FEATURE_ENTITLEMENTS)'), 'plan lookup failures preserve full default feature access');
check(routeGate.includes('!planFeatures[feature]'), 'direct URL routes enforce plan feature availability');
check(routeGate.includes('!settings.features[feature]'), 'global platform switches remain available to platform admins');
check(appLayout.includes('settings.features[item.feature] && planFeatures[item.feature]'),
  'navigation visibility matches both plan entitlements and global switches');

console.log('Plan feature entitlement smoke tests passed.');
