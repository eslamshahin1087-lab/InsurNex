import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MEDICAL_GEMINI_ENABLE_FLAG,
  MEDICAL_GEMINI_TERMS_APPROVAL_FLAG,
  isMedicalGeminiAllowed,
} from '../src/features/medical-intelligence/medical-ai-policy.js';

assert.equal(isMedicalGeminiAllowed(), false, 'external medical AI must be disabled when no flags are set');
assert.equal(isMedicalGeminiAllowed(null), false, 'invalid policy input must fail closed');
assert.equal(isMedicalGeminiAllowed('true'), false, 'non-object policy input must fail closed');
assert.equal(
  isMedicalGeminiAllowed({ [MEDICAL_GEMINI_ENABLE_FLAG]: 'true' }),
  false,
  'data-processing approval alone must not enable the external provider',
);
assert.equal(
  isMedicalGeminiAllowed({ [MEDICAL_GEMINI_TERMS_APPROVAL_FLAG]: 'true' }),
  false,
  'provider-terms approval alone must not enable external medical data processing',
);
assert.equal(
  isMedicalGeminiAllowed({
    [MEDICAL_GEMINI_ENABLE_FLAG]: 'true',
    [MEDICAL_GEMINI_TERMS_APPROVAL_FLAG]: 'true',
  }),
  true,
  'both explicit build-time approvals are required',
);
assert.equal(
  isMedicalGeminiAllowed({
    [MEDICAL_GEMINI_ENABLE_FLAG]: 'TRUE',
    [MEDICAL_GEMINI_TERMS_APPROVAL_FLAG]: 'true',
  }),
  false,
  'non-literal approval values must not activate the external provider',
);

const client = await readFile(new URL('../src/features/medical-intelligence/gemini-medical.client.ts', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/MedicalIntelligencePage.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/theme/gemini-medical50.css', import.meta.url), 'utf8');
const functionsIndex = await readFile(new URL('../functions/src/index.ts', import.meta.url), 'utf8');

assert.match(
  functionsIndex,
  /LEGACY_MEDICAL_CLAUDE_ENABLED\s*=\s*defineString\('LEGACY_MEDICAL_CLAUDE_ENABLED',\s*\{\s*default:\s*'false'\s*\}\)/,
  'the legacy paid Anthropic medical callable must be disabled by default',
);
assert.match(
  functionsIndex,
  /ANTHROPIC_MEDICAL_TERMS_APPROVED\s*=\s*defineString\('ANTHROPIC_MEDICAL_TERMS_APPROVED',\s*\{\s*default:\s*'false'\s*\}\)/,
  'provider terms must have a separate explicit approval gate',
);
const medicalGate = functionsIndex.indexOf("LEGACY_MEDICAL_CLAUDE_ENABLED.value()!=='true'");
const providerCall = functionsIndex.indexOf('new Anthropic(');
assert.ok(medicalGate >= 0 && providerCall > medicalGate, 'the paid provider call must remain behind the default-deny runtime gate');
assert.match(
  functionsIndex,
  /ANTHROPIC_MEDICAL_TERMS_APPROVED\.value\(\)!=='true'/,
  'the callable must require both explicit approvals before provider processing',
);

assert.match(
  client,
  /if \(!isMedicalGeminiAllowed\(import\.meta\.env\)\)\s*\{\s*throw new Error\('EXTERNAL_MEDICAL_AI_DISABLED'\)/,
  'the Gemini service itself must fail closed before building or sending the prompt',
);
assert.match(
  page,
  /const externalMedicalAiEnabled = isMedicalGeminiAllowed\(import\.meta\.env\)/,
  'the Medical Intelligence UI must use the same build-time privacy gate',
);
assert.match(
  page,
  /externalMedicalAiEnabled \? \(/,
  'the external Gemini control must only appear when both approvals are present',
);
assert.match(
  page,
  /التفسير الخارجي متوقف افتراضيًا/,
  'the disabled state must explain why external medical interpretation is unavailable',
);
assert.match(
  page,
  /التحليلات الحتمية المحلية وتصدير PDF متاحان/,
  'the disabled state must preserve access to local calculations and reports',
);
assert.match(
  css,
  /\.gemini50-privacy-note/,
  'the disabled-state privacy notice must be styled within the Gemini panel',
);

console.log('Medical AI default-deny privacy gate tests passed.');
