import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_HOSTING_PROJECT_ID = 'insurnex-8a9df';
export const PRODUCTION_HOSTING_DEPLOY_OPT_IN = 'INSURNEX_ALLOW_PRODUCTION_HOSTING_DEPLOY';

export function validateProductionHostingDeploy(env = process.env) {
  const errors = [];

  if (env[PRODUCTION_HOSTING_DEPLOY_OPT_IN] !== 'true') {
    errors.push(
      `Production Hosting deployment is blocked. Set ${PRODUCTION_HOSTING_DEPLOY_OPT_IN}=true only after explicitly approving deployment to ${PRODUCTION_HOSTING_PROJECT_ID}.`,
    );
  }

  const configuredProject = typeof env.GCLOUD_PROJECT === 'string'
    ? env.GCLOUD_PROJECT.trim()
    : '';
  if (configuredProject && configuredProject !== PRODUCTION_HOSTING_PROJECT_ID) {
    errors.push(
      `GCLOUD_PROJECT targets ${configuredProject}, but this command is pinned to ${PRODUCTION_HOSTING_PROJECT_ID}. Refusing to deploy with conflicting project context.`,
    );
  }

  return errors;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const errors = validateProductionHostingDeploy();

  if (errors.length > 0) {
    console.error('InsurNex production Hosting deployment guard blocked execution:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Explicit production Hosting deployment approval confirmed for ${PRODUCTION_HOSTING_PROJECT_ID}.`);
  }
}
