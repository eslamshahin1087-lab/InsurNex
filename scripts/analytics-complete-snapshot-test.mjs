import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAnalyticsSnapshot } from '../src/features/analytics/analytics-metrics.js';

const clients = Array.from({ length: 601 }, (_, index) => ({
  id: `client-${index}`,
  status: index % 2 ? 'active' : 'inactive',
}));
const policies = [
  { id: 'egp', status: 'active', currency: 'EGP', premium: 1200 },
  { id: 'usd', status: 'expired', currency: 'USD', premium: 20 },
  { id: 'unknown-currency', currency: '', premium: 5 },
];
const claims = [
  { id: 'claim-egp', currency: 'EGP', claimAmount: 900 },
  { id: 'claim-usd', currency: 'USD', claimAmount: 10 },
];
const leads = Array.from({ length: 601 }, (_, index) => ({
  id: `lead-${index}`,
  stage: index === 0 ? 'won' : index === 1 ? 'lost' : 'qualified',
  source: index % 2 ? 'website' : 'referral',
  insuranceType: 'medical',
  preferredInsurerName: 'Insurer A',
  estimatedValue: 100,
}));
const tasks = [
  { id: 'open', status: 'pending' },
  { id: 'done', status: 'completed' },
];

const result = buildAnalyticsSnapshot(
  { clients, policies, claims, leads, tasks },
  '2026-11-14T00:00:00.000Z',
);
assert.equal(result.clients, 601, 'all client rows contribute');
assert.equal(result.activeClients, 300, 'active client count uses the full input');
assert.deepEqual(result.premiumByCurrency, { EGP: 1200, USD: 20, UNKNOWN: 5 });
assert.deepEqual(result.claimAmountByCurrency, { EGP: 900, USD: 10 });
assert.equal(result.leads, 601, 'all lead rows contribute');
assert.equal(result.pipeline, 59900, 'won and lost leads are excluded from pipeline');
assert.equal(result.insurers['Insurer A'], 59900, 'insurer chart uses open pipeline only');
assert.equal(result.won, 1);
assert.equal(result.lost, 1);
assert.equal(result.winRate, 50);
assert.equal(result.openTasks, 1);
assert.equal(result.tasks, 2);
assert.equal(result.completedTasks, 1);
assert.equal(result.taskCompletionRate, 50);
assert.equal(result.generatedAt, '2026-11-14T00:00:00.000Z');

const emptyTasks = buildAnalyticsSnapshot({ clients: [], policies: [], claims: [], leads: [], tasks: [] });
assert.equal(emptyTasks.taskCompletionRate, 0, 'task completion rate is zero when there are no tasks');

const service = await readFile(new URL('../src/features/analytics/analytics.service.ts', import.meta.url), 'utf8');
assert.match(service, /startAfter\(cursor\)/, 'analytics service paginates with a document cursor');
assert.match(service, /snapshot\.size < ANALYTICS_PAGE_SIZE/, 'analytics service continues until the final page');
assert.match(service, /ANALYTICS_PAGE_SIZE = 500/, 'page size is an implementation detail, not a reporting cap');

const page = await readFile(new URL('../src/pages/AnalyticsPage.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(page, /const trend = \[/, 'analytics must not show a fabricated trend');
assert.match(page, /premiumByCurrency/, 'policy premium totals remain separated by currency');
assert.match(page, /inx-analytics-performance-grid/, 'analytics exposes a responsive performance indicator grid');
assert.match(page, /taskCompletionRate/, 'task completion indicator comes from complete task data');
assert.match(page, /progressLabel/, 'performance indicators explain what each percentage measures');
console.log('Complete analytics snapshot tests passed.');
