import { test, expect } from '@playwright/test';

const PROJECT_ID = 'insurnex-8a9df';
const BASE_PATH = '/InsurNex-User.html';

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function firebaseState(page) {
  return page.evaluate(() => ({
    projectId: window.firebase?.app?.()?.options?.projectId || null,
    uid: window.InsurNex?.auth?.currentUser?.uid || null,
    signedIn: !!window.InsurNex?.auth?.currentUser,
  }));
}

async function cleanupWorkspace(page, uid, deleteAuth) {
  const cleanupPage = await page.context().newPage();
  try {
    await cleanupPage.goto(`${process.env.E2E_BASE_URL || 'http://localhost:4173'}${BASE_PATH}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    }).catch(() => {});

    await cleanupPage.waitForTimeout(500);

    await cleanupPage.evaluate(async ({ uid, deleteAuth }) => {
      const IN = window.InsurNex;
      if (!IN?.db || !IN?.auth?.currentUser) return;

      const collections = [
        'customers',
        'leads',
        'opportunities',
        'quotations',
        'policies',
        'renewals',
        'claims',
        'tasks',
        'documents',
        'documentExtractions',
        'insuranceAssessments',
        'insuranceFileAnalyses',
        'aiInsights',
        'aiActions',
        'commissions',
        'payments',
        'financialTransactions',
        'expenses',
        'insuranceComparisons',
        'communications',
        'notifications',
        'calendarEvents',
        'activities',
      ];

      for (const collection of collections) {
        try {
          const snap = await IN.db.collection(collection).where('ownerId', '==', uid).where('workspaceType', '==', 'personal').limit(200).get();
          for (const doc of snap.docs) {
            try { await doc.ref.delete(); } catch (_) {}
          }
        } catch (_) {}
      }

      try { await IN.db.collection('brokerProfiles').doc(uid).delete(); } catch (_) {}
      try { await IN.db.collection('users').doc(uid).delete(); } catch (_) {}

      if (deleteAuth && IN.auth.currentUser) {
        try { await IN.auth.currentUser.delete(); } catch (_) {}
      }
    }, { uid, deleteAuth });
  } catch (_) {
    // Cleanup must never turn a completed product-flow test into a false failure.
  } finally {
    await cleanupPage.close().catch(() => {});
  }
}

async function registerOrLogin(page, testInfo, pageErrors) {
  const configuredEmail = process.env.INSURNEX_E2E_EMAIL?.trim();
  const configuredPassword = process.env.INSURNEX_E2E_PASSWORD;
  const createdByTest = !configuredEmail;
  const email = configuredEmail || `e2e-${Date.now()}-${testInfo.project.name}@example.com`;
  const password = configuredPassword || `InsurNex-E2E-${Date.now()}!`;

  await page.goto(`${process.env.E2E_BASE_URL || 'http://localhost:4173'}${BASE_PATH}#register`);
  await page.locator('#authForm').waitFor({ state: 'visible', timeout: 30000 });

  if (createdByTest) {
    const registerName = page.locator('#authForm input[name="name"]');
    if (!(await registerName.count())) {
      await page.locator('#switchAuth').click();
      await registerName.waitFor({ state: 'visible', timeout: 10000 });
    }
    await registerName.fill(`InsurNex E2E ${testInfo.project.name}`);
    await page.locator('#authForm input[name="mobile"]').fill('01000000000');
    await page.locator('#authForm input[name="country"]').fill('Egypt');
    await page.locator('#authForm input[name="city"]').fill('Cairo');
    await page.locator('#authForm input[name="email"]').fill(email);
    await page.locator('#authForm input[name="password"]').fill(password);
    await page.locator('#authForm input[name="confirmPassword"]').fill(password);
    await page.locator('#authForm input[name="terms"]').check();
        const accountType = page.locator('#authForm select[name="accountType"]');
    if (await accountType.count()) await accountType.selectOption('individual_broker');
    await page.locator('#authForm button[type="submit"]').click();
  } else {
    await page.locator('#switchAuth').click();
    await page.locator('#authForm input[name="email"]').fill(email);
    await page.locator('#authForm input[name="password"]').fill(password);
    await page.locator('#authForm button[type="submit"]').click();
  }

  await expect.poll(async () => {
    const home = await page.locator('#home').count();
    const onboarding = await page.locator('#masterOnboarding').count();
    return home + onboarding;
  }, { timeout: 45000 }).toBeGreaterThan(0);

  const onboarding = page.locator('#masterOnboarding');
  if (await onboarding.count()) {
    await onboarding.locator('input[name="fullName"]').fill(`InsurNex E2E ${testInfo.project.name}`);
    await onboarding.locator('input[name="mobile"]').fill('01000000000');
    await onboarding.locator('input[name="country"]').fill('Egypt');
    await onboarding.locator('input[name="city"]').fill('Cairo');
    await onboarding.locator('input[name="licenseNumber"]').fill('E2E-LICENSE');
    await onboarding.locator('input[name="specialization"]').fill('General Insurance');
    await onboarding.locator('input[name="insuranceLines"]').fill('Motor, Medical');
    await onboarding.locator('#onboardingSave').click();
  }

  await page.locator('#home').waitFor({ state: 'visible', timeout: 45000 });
  const state = await firebaseState(page);
  expect(state.projectId).toBe(PROJECT_ID);
  expect(state.signedIn).toBeTruthy();

  return { email, password, uid: state.uid, createdByTest };
}

async function waitForRecord(page, collection, field, value) {
  await expect.poll(async () => page.evaluate(async ({ collection, field, value }) => {
    const s = await window.InsurNex.db.collection(collection).where(field, '==', value).limit(1).get();
    return !s.empty;
  }, { collection, field, value }), { timeout: 30000 }).toBeTruthy();
}

async function countOwned(page, collection, uid) {
  return page.evaluate(async ({ collection, uid }) => {
    const s = await window.InsurNex.db.collection(collection).where('ownerId', '==', uid).where('workspaceType', '==', 'personal').get();
    return s.size;
  }, { collection, uid });
}

test.describe('InsurNex real Firebase browser E2E', () => {
  test('auth + CRM pipeline + customer assessment + payment', async ({ page }, testInfo) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const account = await registerOrLogin(page, testInfo, pageErrors);
    expect(pageErrors, 'No uncaught browser JavaScript errors during authentication').toEqual([]);

    try {
      const initialCustomers = await countOwned(page, 'customers', account.uid);
      await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'}${BASE_PATH}#crm`);
      await page.locator('[data-add="customers"]').click();
      await page.locator('#recordForm input[name="fullName"]').fill(`E2E Customer ${testInfo.project.name}`);
      await page.locator('#recordForm input[name="mobile"]').fill('01111111111');
      await page.locator('#recordForm input[name="email"]').fill(account.email);
      await page.locator('#recordForm button[type="submit"]').click();
      await waitForRecord(page, 'customers', 'fullName', `E2E Customer ${testInfo.project.name}`);
      expect(await countOwned(page, 'customers', account.uid)).toBe(initialCustomers + 1);

      const customerButton = page.locator('[data-customer]').first();
      await customerButton.click();
      await expect(page.locator('#modal')).toHaveClass(/show/);
      await page.locator('#modalTitle').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape').catch(() => {});
      await page.locator('#modal').evaluate(el => el.classList.remove('show'));

      const assessmentButton = page.locator('[data-crm-action^="customer-assessment:"]').first();
      await assessmentButton.click();
      await expect(page.locator('#modal')).toHaveClass(/show/);
      await expect(page.locator('#modalBody')).toContainText(/Insurance Profile Score|مؤشر مشتق/);
      await page.locator('#modal').evaluate(el => el.classList.remove('show'));

      await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'}${BASE_PATH}#opportunities`);
      await page.locator('[data-add="leads"]').click();
      const leadName = `E2E Lead ${testInfo.project.name}`;
      await page.locator('#recordForm input[name="fullName"]').fill(leadName);
      await page.locator('#recordForm input[name="phone"]').fill('01222222222');
      await page.locator('#recordForm input[name="email"]').fill(account.email);
      await page.locator('#recordForm input[name="insuranceType"]').fill('Motor');
      await page.locator('#recordForm input[name="estimatedPremium"]').fill('1000');
      await page.locator('#recordForm select[name="priority"]').selectOption('hot');
      await page.locator('#recordForm select[name="stage"]').selectOption('New');
      await page.locator('#recordForm input[name="expectedCloseDate"]').fill(today(30));
      await page.locator('#recordForm button[type="submit"]').click();
      await waitForRecord(page, 'leads', 'fullName', leadName);

      await page.locator('[data-crm-action^="lead-needs-analysis:"]').first().click();
      await expect(page.locator('#modalBody')).toContainText(/Suggested questions|أسئلة مقترحة/);
      await page.locator('#modal').evaluate(el => el.classList.remove('show'));

      await page.locator('[data-crm-action^="convert-lead:"]').first().click();
      await expect.poll(() => countOwned(page, 'opportunities', account.uid), { timeout: 30000 }).toBeGreaterThan(0);

      await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'}${BASE_PATH}#opportunities`);
      await page.locator('[data-crm-action^="convert-opportunity:"]').first().click();
      await expect.poll(() => countOwned(page, 'quotations', account.uid), { timeout: 30000 }).toBeGreaterThan(0);

      await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'}${BASE_PATH}#quotations`);
      await page.locator('[data-crm-action^="issue-quote:"]').first().click();
      await page.locator('#wfPolicyForm input[name="policyNumber"]').fill(`E2E-${Date.now()}`);
      await page.locator('#wfPolicyForm input[name="insurer"]').fill('E2E Insurer');
      await page.locator('#wfPolicyForm input[name="product"]').fill('Motor');
      await page.locator('#wfPolicyForm input[name="premium"]').fill('1000');
      await page.locator('#wfPolicyForm input[name="startDate"]').fill(today());
      await page.locator('#wfPolicyForm input[name="expiryDate"]').fill(today(365));
      await page.locator('#wfPolicyForm input[name="commissionAmount"]').fill('100');
      await page.locator('#wfPolicyForm select[name="paymentStatus"]').selectOption('partial');
      await page.locator('#wfPolicyForm button[type="submit"]').click();
      await expect.poll(() => countOwned(page, 'policies', account.uid), { timeout: 30000 }).toBeGreaterThan(0);

      await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'}${BASE_PATH}#policies`);
      await page.locator('[data-crm-action^="policy-payment:"]').first().click();
      await page.locator('#wfPayment input[name="amount"]').fill('100');
      await page.locator('#wfPayment select[name="status"]').selectOption('partial');
      await page.locator('#wfPayment button[type="submit"]').click();
      await expect.poll(() => countOwned(page, 'payments', account.uid), { timeout: 30000 }).toBeGreaterThan(0);

      const finalState = await firebaseState(page);
      expect(finalState.projectId).toBe(PROJECT_ID);
      expect(finalState.uid).toBe(account.uid);
    } finally {
      await cleanupWorkspace(page, account.uid, account.createdByTest);
    }
  });
});
