import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = readFileSync(resolve(root, 'src/features/clients/components/AiAnalysisChatBox.tsx'), 'utf8');
const start = source.indexOf('const analysisPrompt = useMemo');
const end = source.indexOf('// Run analysis on mount', start);
assert.ok(start >= 0 && end > start, 'analysis prompt block must remain discoverable');
const prompt = source.slice(start, end);

for (const field of ['clientName', 'clientCode', 'monthlyIncome', 'maritalStatus', 'riskAssessment.score', 'riskAssessment.level', 'nationalId', 'phone', 'email']) {
  assert.equal(prompt.includes(field), false, 'sensitive field must not be included in the provider prompt: ' + field);
}
assert.equal(prompt.includes('**الاسم:**'), false, 'client name label must not be included in the prompt');
assert.equal(source.includes("content: 'تحليل احتياجات التأمين للعميل الجديد'"), true, 'follow-up history must start with a non-identifying message');
assert.equal(source.includes('organizationId: copilotScope'), true, 'analysis requests must include the authorized workspace scope');
assert.equal(source.includes('errMsg'), false, 'raw provider errors must not be rendered to the user');
assert.equal(source.includes("console.error('Analysis failed'"), false, 'raw provider errors must not be logged');

console.log('Copilot client-data minimization checks passed.');
