import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

const guardScriptPath = fileURLToPath(new URL('./guard-production-hosting-deploy.mjs', import.meta.url));
const blockedCliEnv = { ...process.env };
delete blockedCliEnv[PRODUCTION_HOSTING_DEPLOY_OPT_IN];
delete blockedCliEnv.GCLOUD_PROJECT;
const blockedCli = spawnSync(process.execPath, [guardScriptPath], {
  env: blockedCliEnv,
  encoding: 'utf8',
});
assert.equal(blockedCli.status, 1, 'guard CLI must exit before deployment when approval is absent');
assert.match(blockedCli.stderr, /deployment guard blocked execution/);

const approvedCli = spawnSync(process.execPath, [guardScriptPath], {
  env: {
    ...blockedCliEnv,
    [PRODUCTION_HOSTING_DEPLOY_OPT_IN]: 'true',
    GCLOUD_PROJECT: PRODUCTION_HOSTING_PROJECT_ID,
  },
  encoding: 'utf8',
});
assert.equal(approvedCli.status, 0, approvedCli.stderr);
assert.match(approvedCli.stdout, /Explicit production Hosting deployment approval confirmed/);

console.log('Production Hosting deployment authorization guard tests passed.');
