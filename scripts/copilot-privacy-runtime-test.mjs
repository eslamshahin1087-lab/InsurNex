import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const edge = await readFile(new URL('../supabase/functions/copilot-chat/index.ts', import.meta.url), 'utf8');
const privacyUi = [
  { path: 'src/pages/CopilotPage.tsx', className: 'copilot-privacy-notice' },
  { path: 'src/features/copilot/CopilotFloatingPanel.tsx', className: 'copilot-privacy-notice' },
  { path: 'src/features/clients/components/AiAnalysisChatBox.tsx', className: 'client-wizard-privacy-notice' },
];
const uiSources = await Promise.all(privacyUi.map(({ path }) =>
  readFile(new URL('../' + path, import.meta.url), 'utf8')
));

assert.doesNotMatch(
  edge,
  /FIREBASE_PROJECT_ID[^\n]*insurnex-8a9df/,
  'Copilot must not silently fall back to the production Firebase project',
);
assert.match(edge, /FIREBASE_PROJECT_ID_NOT_CONFIGURED/, 'missing Firebase project configuration must fail closed');
assert.match(edge, /resolveCopilotPrivacyPolicy/, 'Copilot must use the privacy policy');
assert.match(
  edge,
  /COPILOT_PRIVACY_POLICY\.allowBusinessContext\s*\?\s*await buildAuthorizedCopilotContext/s,
  'Firestore business context must be loaded only after the explicit privacy gate',
);
assert.match(edge, /providerOrder\.includes\('groq'\)/, 'Groq routing must honor the policy provider order');
assert.match(edge, /providerOrder\.includes\('gemini'\)/, 'Gemini routing must honor the policy provider order');

for (let index = 0; index < uiSources.length; index += 1) {
  assert.ok(
    uiSources[index].includes(privacyUi[index].className),
    privacyUi[index].path + ' must display its privacy notice',
  );
}

const clientWizardChat = uiSources[2];
for (const forbiddenPromptField of [
  'wizardData.individual',
  'wizardData.riskData',
  'wizardData.preferences',
  'wizardData.notes',
  'c.companyName',
  'c.commercialRegister',
  'c.taxCard',
  'c.authorizedSignatoryNid',
  'c.authorizedSignatory',
  'c.website',
  'c.street',
  'c.area',
]) {
  assert.equal(
    clientWizardChat.includes(forbiddenPromptField),
    false,
    'the automatic client-wizard prompt must not serialize ' + forbiddenPromptField,
  );
}
assert.match(
  clientWizardChat,
  /التحليل التلقائي يرسل ملخصًا عامًا غير معرّف/,
  'the privacy notice must accurately describe the limited automatic prompt',
);

console.log('Copilot privacy runtime source guards passed.');
