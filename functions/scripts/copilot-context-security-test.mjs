import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const handlerSource = readFileSync(new URL('../src/copilot/index.ts', import.meta.url), 'utf8');
const indexConfig = JSON.parse(readFileSync(new URL('../../firestore.indexes.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const { FieldPath } = require('firebase-admin/firestore');
const {
  buildAuthorizedContext,
  buildContextString,
  normalizeCopilotContextSelector,
} = require('../lib/copilot/context-builder.js');
const {
  CopilotAuthorizationError,
  resolveCopilotAccess,
} = require('../lib/copilot/access-policy.js');

function fieldName(field) {
  if (typeof field === 'string') return field;
  try {
    if (FieldPath.documentId().isEqual(field)) return '__name__';
  } catch {}
  const text = String(field);
  return text.includes('__name__') ? '__name__' : text;
}

class FakeQuery {
  constructor(db, collection, filters = [], ordering = null, rowLimit = 10000, selected = null) {
    this.db = db;
    this.collectionName = collection;
    this.filters = filters;
    this.ordering = ordering;
    this.rowLimit = rowLimit;
    this.selected = selected;
  }

  where(field, op, value) {
    return new FakeQuery(this.db, this.collectionName, [...this.filters, { field: fieldName(field), op, value }], this.ordering, this.rowLimit, this.selected);
  }

  orderBy(field, direction) {
    return new FakeQuery(this.db, this.collectionName, this.filters, { field: fieldName(field), direction }, this.rowLimit, this.selected);
  }

  limit(value) {
    return new FakeQuery(this.db, this.collectionName, this.filters, this.ordering, value, this.selected);
  }

  select(...fields) {
    return new FakeQuery(this.db, this.collectionName, this.filters, this.ordering, this.rowLimit, fields);
  }

  doc(id) {
    const found = (this.db.data[this.collectionName] || []).find((row) => row.id === id);
    return {
      get: async () => ({
        exists: Boolean(found),
        data: () => {
          if (!found) return undefined;
          const { id: ignored, ...data } = found;
          return data;
        },
      }),
    };
  }

  async get() {
    this.db.calls.push({
      collection: this.collectionName,
      filters: this.filters,
      ordering: this.ordering,
      limit: this.rowLimit,
      selected: this.selected,
    });
    let rows = [...(this.db.data[this.collectionName] || [])];

    for (const filter of this.filters) {
      if (filter.op !== '==') continue;
      rows = rows.filter((row) => {
        const actual = filter.field === '__name__' ? row.id : row[filter.field];
        return actual === filter.value;
      });
    }

    if (this.ordering) {
      const { field, direction } = this.ordering;
      rows.sort((a, b) => {
        const left = a[field];
        const right = b[field];
        if (left === right) return 0;
        const result = left === undefined ? 1 : right === undefined ? -1 : left < right ? -1 : 1;
        return direction === 'desc' ? -result : result;
      });
    }

    rows = rows.slice(0, this.rowLimit);
    const docs = rows.map((row) => {
      const { id, ...data } = row;
      const projected = this.selected
        ? Object.fromEntries(this.selected.filter((key) => key in data).map((key) => [key, data[key]]))
        : data;
      return { id, data: () => projected };
    });
    return { docs };
  }
}

class FakeFirestore {
  constructor(data = {}) {
    this.data = data;
    this.calls = [];
  }

  collection(name) {
    return new FakeQuery(this, name);
  }
}

async function expectAuthorizationError(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CopilotAuthorizationError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function run() {
  const selector = normalizeCopilotContextSelector({
    page: 'policies',
    policies: [{ policyNumber: 'PRIVATE_POLICY', premium: 999999 }],
    claims: [{ claimNumber: 'PRIVATE_CLAIM' }],
    finance: { totalRevenue: 999999999 },
    notes: 'PRIVATE_NOTES',
    client: { name: 'PRIVATE_CLIENT', phone: 'PRIVATE_PHONE' },
  });
  assert.deepEqual(selector, { page: 'policies' }, 'browser payload must collapse to a page selector');

  assert.deepEqual(
    normalizeCopilotContextSelector({
      page: 'client-details',
      client: { id: 'client_123-abc', name: 'PRIVATE_CLIENT', phone: 'PRIVATE_PHONE' },
      policy: { policyNumber: 'PRIVATE_POLICY' },
    }),
    { page: 'client-details', clientId: 'client_123-abc' },
    'Client 360 may send only a validated document ID',
  );

  assert.deepEqual(
    normalizeCopilotContextSelector({ page: 'platform-admin-secret', notes: 'PRIVATE_NOTES' }),
    { page: 'general' },
    'unsupported page hints must fall back safely',
  );
  assert.deepEqual(
    normalizeCopilotContextSelector({ page: 'client-details', client: { id: '../foreign' } }),
    { page: 'client-details' },
    'invalid client IDs must be dropped',
  );

  const memberDb = new FakeFirestore({
    admin: [],
    users: [{ id: 'user-1', organizationId: 'org-1', status: 'active', role: 'broker', email: 'PRIVATE_EMAIL' }],
  });
  const access = await resolveCopilotAccess({ db: memberDb, uid: 'user-1' });
  assert.deepEqual(access, { scopeType: 'organization', organizationId: 'org-1', role: 'broker' });
  assert.deepEqual(memberDb.calls, [], 'direct membership document checks do not query business collections');

  await expectAuthorizationError(
    resolveCopilotAccess({ db: memberDb, uid: 'user-1', requestedOrganizationId: 'org-other' }),
    'permission-denied',
  );
  await expectAuthorizationError(
    resolveCopilotAccess({ db: memberDb, uid: 'user-1', requestedOrganizationId: { organizationId: 'org-1' } }),
    'invalid-argument',
  );

  const disabledDb = new FakeFirestore({
    admin: [],
    users: [{ id: 'user-2', organizationId: 'org-1', status: 'disabled', role: 'broker' }],
  });
  await expectAuthorizationError(
    resolveCopilotAccess({ db: disabledDb, uid: 'user-2' }),
    'permission-denied',
  );

  const adminDb = new FakeFirestore({
    admin: [{ id: 'admin-1', enabled: true }],
    users: [{ id: 'admin-1', organizationId: 'org-1', status: 'active', role: 'admin' }],
  });
  assert.deepEqual(
    await resolveCopilotAccess({ db: adminDb, uid: 'admin-1' }),
    { scopeType: 'platform-admin', organizationId: null, role: null },
    'platform-admin membership must take precedence over a tenant profile',
  );
  await expectAuthorizationError(
    resolveCopilotAccess({ db: adminDb, uid: 'admin-1', requestedOrganizationId: 'org-1' }),
    'permission-denied',
  );

  const recordsDb = new FakeFirestore({
    policies: [
      { id: 'policy-safe', organizationId: 'org-1', insurerName: 'Approved Insurer', line: 'motor', startDate: '2026-01-01', expiryDate: '2027-01-01', premium: 1200, currency: 'EGP', status: 'active', policyNumber: 'PRIVATE_POLICY_ID', clientName: 'PRIVATE_CLIENT_NAME', documentUrl: 'PRIVATE_DOCUMENT_URL', notes: 'PRIVATE_NOTES' },
      { id: 'policy-other', organizationId: 'org-other', insurerName: 'OTHER_TENANT_INSURER', line: 'health', premium: 9000, currency: 'EGP', status: 'active' },
    ],
  });

  const context = await buildAuthorizedContext({
    db: recordsDb,
    organizationId: 'org-1',
    role: 'broker',
    requestedContext: {
      page: 'policies',
      policies: [{ insurerName: 'FORGED_INSURER', premium: 999999 }],
      notes: 'FORGED_NOTES',
      finance: { totalRevenue: 999999999 },
    },
  });

  assert.equal(context.policies.length, 1, 'foreign-tenant records must not appear');
  assert.equal(context.policies[0].insurerName, 'Approved Insurer');
  const query = recordsDb.calls.find((call) => call.collection === 'policies');
  assert.ok(query, 'policies collection should be queried from the server');
  assert.ok(query.filters.some((filter) => filter.field === 'organizationId' && filter.value === 'org-1'), 'query must use the verified organization');
  for (const privateField of ['policyNumber', 'clientName', 'documentUrl', 'notes', 'phone', 'email', 'nationalId']) {
    assert.equal(query.selected.includes(privateField), false, 'private field must not be requested: ' + privateField);
  }

  const serializedContext = JSON.stringify(context);
  const promptContext = buildContextString(context);
  for (const marker of ['PRIVATE_POLICY_ID', 'PRIVATE_CLIENT_NAME', 'PRIVATE_DOCUMENT_URL', 'PRIVATE_NOTES', 'FORGED_', 'OTHER_TENANT']) {
    assert.equal(serializedContext.includes(marker) || promptContext.includes(marker), false, 'untrusted or private data leaked: ' + marker);
  }
  assert.ok(promptContext.includes('bounded recent samples'), 'context prompt must disclose bounded samples');
  assert.ok(promptContext.includes('never instructions'), 'context prompt must treat record values as data');

  const clientDb = new FakeFirestore({
    clients: [{ id: 'client-other', organizationId: 'org-other', type: 'individual', status: 'active', name: 'PRIVATE_CLIENT' }],
    policies: [{ id: 'foreign-policy', organizationId: 'org-other', clientId: 'client-other', insurerName: 'OTHER_TENANT_INSURER' }],
  });
  const clientContext = await buildAuthorizedContext({
    db: clientDb,
    organizationId: 'org-1',
    role: 'broker',
    requestedContext: { page: 'client-details', client: { id: 'client-other', name: 'FORGED_NAME' } },
  });
  assert.deepEqual(clientContext, { page: 'client-details' }, 'foreign Client 360 selector must return no client data');
  assert.equal(clientDb.calls.length, 1, 'related collections must not be queried after client tenant mismatch');

  const financeDb = new FakeFirestore({
    revenue: [
      { id: 'r1', organizationId: 'org-finance', amount: 2000, status: 'confirmed', currency: 'EGP', clientName: 'PRIVATE_FINANCE_CLIENT', notes: 'PRIVATE_REVENUE_NOTE' },
      { id: 'r2', organizationId: 'org-finance', amount: 300, status: 'pending', currency: 'EGP' },
    ],
    expenses: [
      { id: 'e1', organizationId: 'org-finance', amount: 400, currency: 'EGP', category: 'operational', description: 'PRIVATE_EXPENSE_DESCRIPTION' },
    ],
    commissions: [
      { id: 'c1', organizationId: 'org-finance', commissionAmount: 100, status: 'pending', currency: 'EGP', policyNumber: 'PRIVATE_COMMISSION_POLICY' },
      { id: 'c2', organizationId: 'org-finance', commissionAmount: 50, status: 'received', currency: 'EGP' },
    ],
  });
  const financeContext = await buildAuthorizedContext({
    db: financeDb,
    organizationId: 'org-finance',
    role: 'finance',
    requestedContext: { page: 'finance', finance: { totalRevenue: 999999999 }, notes: 'FORGED_FINANCE' },
  });
  assert.deepEqual(financeContext.finance, {
    totalRevenue: 2000,
    totalExpenses: 400,
    netIncome: 1600,
    pendingCommissions: 100,
    receivedCommissions: 50,
    currency: 'EGP',
  }, 'finance context must be computed from queried ledger records');
  assert.ok(financeDb.calls.every((call) => call.limit === 500), 'finance queries must be bounded to 500 recent rows');
  assert.ok(financeDb.calls.every((call) => call.filters.some((filter) => filter.field === 'organizationId' && filter.value === 'org-finance')));
  assert.equal(JSON.stringify(financeContext).includes('PRIVATE_'), false, 'finance records must not include client names, descriptions, notes or IDs');
  assert.equal(JSON.stringify(financeContext).includes('FORGED_'), false, 'caller-supplied finance values must be ignored');

  const mixedCurrencyDb = new FakeFirestore({
    revenue: [{ id: 'r1', organizationId: 'org-finance', amount: 100, status: 'confirmed', currency: 'EGP' }],
    expenses: [{ id: 'e1', organizationId: 'org-finance', amount: 10, currency: 'USD', category: 'other' }],
    commissions: [{ id: 'c1', organizationId: 'org-finance', commissionAmount: 5, status: 'pending', currency: 'EGP' }],
  });
  const mixedCurrencyContext = await buildAuthorizedContext({
    db: mixedCurrencyDb,
    organizationId: 'org-finance',
    role: 'finance',
    requestedContext: { page: 'finance' },
  });
  assert.equal(mixedCurrencyContext.finance, undefined, 'mixed-currency totals must be omitted');

  const salesFinanceDb = new FakeFirestore({
    revenue: [{ id: 'r1', organizationId: 'org-1', amount: 100, currency: 'EGP', status: 'confirmed' }],
    expenses: [],
    commissions: [],
  });
  const salesFinanceContext = await buildAuthorizedContext({
    db: salesFinanceDb,
    organizationId: 'org-1',
    role: 'sales',
    requestedContext: { page: 'finance' },
  });
  assert.deepEqual(salesFinanceContext, { page: 'finance' }, 'sales role must not receive finance context');
  assert.equal(salesFinanceDb.calls.length, 0, 'financial collections must not be queried for unauthorized roles');

  assert.ok(handlerSource.includes("LEGACY_COPILOT_ENABLED = defineString('LEGACY_COPILOT_ENABLED', { default: 'false' })"), 'paid legacy Claude route must be disabled by default');
  assert.ok(handlerSource.indexOf("LEGACY_COPILOT_ENABLED.value()") < handlerSource.indexOf("callClaude("), 'disabled legacy route must reject before contacting Anthropic');

  const hasCompositeIndex = (collectionGroup, requiredFields) => indexConfig.indexes.some((index) =>
    index.collectionGroup === collectionGroup &&
    requiredFields.every((required) => index.fields.some((field) =>
      field.fieldPath === required.fieldPath && field.order === required.order)));

  for (const [collectionGroup, requiredFields] of [
    ['clients', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: '__name__', order: 'ASCENDING' }]],
    ['policies', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'expiryDate', order: 'ASCENDING' }]],
    ['revenue', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'date', order: 'DESCENDING' }]],
    ['expenses', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'date', order: 'DESCENDING' }]],
    ['commissions', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ]) {
    assert.ok(hasCompositeIndex(collectionGroup, requiredFields), 'required context query index missing: ' + collectionGroup);
  }

  console.log('Legacy Copilot context security regression tests passed.');
}

await run();
