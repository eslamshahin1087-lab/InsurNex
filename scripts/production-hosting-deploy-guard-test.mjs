import assert from 'node:assert/strict';
import {
  PRODUCTION_HOSTING_DEPLOY_OPT_IN,
  PRODUCTION_HOSTING_PROJECT_ID,
  validateProductionHostingDeploy,
} from './guard-production-hosting-deploy.mjs';

const defaultEnv = {};
assert.ok(
  validateProductionHostingDeploy(defaultEnv).some((error) => error.includes('deployment is blocked')),
  'production deployment must be blocked unless explicit approval is present',
);

const ambiguousApproval = { [PRODUCTION_HOSTING_DEPLOY_OPT_IN]: 'yes' };
assert.ok(
  validateProductionHostingDeploy(ambiguousApproval).some((error) => error.includes('deployment is blocked')),
  'non-literal approval values must not authorize production deployment',
);

const approved = {
  [PRODUCTION_HOSTING_DEPLOY_OPT_IN]: 'true',
  GCLOUD_PROJECT: PRODUCTION_HOSTING_PROJECT_ID,
};
assert.deepEqual(
  validateProductionHostingDeploy(approved),
  [],
  'explicit approval with a matching project context should pass',
);

const conflictingProject = {
  [PRODUCTION_HOSTING_DEPLOY_OPT_IN]: 'true',
  GCLOUD_PROJECT: 'demo-insurnex',
};
assert.ok(
  validateProductionHostingDeploy(conflictingProject).some((error) => error.includes('conflicting project context')),
  'a conflicting active Firebase project must block deployment even when approval is present',
);

console.log('Production Hosting deployment authorization guard tests passed.');
