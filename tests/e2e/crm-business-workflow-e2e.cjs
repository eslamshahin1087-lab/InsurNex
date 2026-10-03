const { chromium, devices } = require('playwright');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/InsurNex-User.html';

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createDisposableUser(page, prefix) {
  return page.evaluate(async prefixName => {
    const appName = 'insurnexE2E';
    const app = window.firebase.apps.find(x => x.name === appName) ||
      window.firebase.initializeApp(window.INSURNEX_CONFIG.firebase, appName);
    const auth = app.auth();
    const email =
      prefixName +
      '-' +
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2, 8) +
      '@example.com';
    const password = 'E2Epass' + Date.now() + 'Aa';

    try {
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      return { ok: true, uid: credential.user.uid, email, password };
    } catch (error) {
      return {
        ok: false,
        code: error.code || '',
        message: error.message || String(error)
      };
    }
  }, prefix);
}

async function signIn(page, email, password) {
  return page.evaluate(async ({ email: targetEmail, password: targetPassword }) => {
    try {
      const appName = 'insurnexE2E';
      const app = window.firebase.apps.find(x => x.name === appName) ||
        window.firebase.initializeApp(window.INSURNEX_CONFIG.firebase, appName);
      await app.auth().signInWithEmailAndPassword(targetEmail, targetPassword);
      return { ok: true, uid: window.firebase.auth().currentUser?.uid || null };
    } catch (error) {
      return {
        ok: false,
        code: error.code || '',
        message: error.message || String(error)
      };
    }
  }, { email, password });
}

async function deleteCurrentAuthUser(page) {
  await page.evaluate(async () => {
    const app = window.firebase.apps.find(x => x.name === 'insurnexE2E');
    const user = app?.auth()?.currentUser;
    if (user) {
      try {
        await user.delete();
      } catch (_) {}
    }
  });
}

async function createRecord(page, collection, data) {
  return page.evaluate(async ({ collection, data }) => {
    const app = window.firebase.apps.find(x => x.name === 'insurnexE2E');
    if (!app) throw new Error('E2E Firebase app not initialized');
    const auth = app.auth();
    const db = app.firestore();
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const payload = {
      ...data,
      workspaceType: 'personal',
      organizationId: null,
      ownerId: user.uid,
      createdBy: user.uid,
      e2eTest: true,
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection(collection).add(payload);
    const snap = await ref.get({ source: 'server' });
    return { id: ref.id, exists: snap.exists, data: snap.data() || {} };
  }, { collection, data });
}

async function updateRecord(page, collection, id, patch) {
  return page.evaluate(async ({ collection, id, patch }) => {
    const app = window.firebase.apps.find(x => x.name === 'insurnexE2E');
    const db = app.firestore();
    const ref = db.collection(collection).doc(id);
    await ref.update({
      ...patch,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    const snap = await ref.get({ source: 'server' });
    return { id, exists: snap.exists, data: snap.data() || {} };
  }, { collection, id, patch });
}

async function deleteRecord(page, collection, id) {
  return page.evaluate(async ({ collection, id }) => {
    const app = window.firebase.apps.find(x => x.name === 'insurnexE2E');
    const db = app.firestore();
    const ref = db.collection(collection).doc(id);
    await ref.delete();
    const snap = await ref.get({ source: 'server' });
    return { deleted: !snap.exists };
  }, { collection, id });
}

async function expectPermissionDenied(page, collection, data) {
  return page.evaluate(async ({ collection, data }) => {
    const app = window.firebase.apps.find(x => x.name === 'insurnexE2E');
    const db = app.firestore();
    const user = app.auth().currentUser;
    if (!user) return { ok: false, reason: 'no-auth-user' };

    try {
      await db.collection(collection).add({
        ...data,
        workspaceType: 'personal',
        organizationId: null,
        ownerId: user.uid,
        createdBy: user.uid,
        e2eTest: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok: false, reason: 'write-was-allowed' };
    } catch (error) {
      return {
        ok: error.code === 'permission-denied',
        code: error.code || '',
        message: error.message || String(error)
      };
    }
  }, { collection, data });
}

async function runContext(browser, name, deviceOptions) {
  const context = await browser.newContext(deviceOptions);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(BASE_URL + '#login', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  const firebaseState = await page.evaluate(() => ({
    projectId: window.INSURNEX_CONFIG?.firebase?.projectId || null,
    initialized: Boolean(window.firebase?.apps?.length),
    authAvailable: Boolean(window.InsurNex?.auth)
  }));

  await assert(firebaseState.projectId === 'insurnex-8a9df', name + ': wrong Firebase project');
  await assert(
    firebaseState.initialized && firebaseState.authAvailable,
    name + ': Firebase runtime unavailable'
  );

  const owner = await createDisposableUser(page, 'insurnex-crm-e2e');
  await assert(
    owner.ok,
    name +
      ': could not create disposable workflow user (' +
      (owner.code || 'unknown') +
      '): ' +
      (owner.message || 'no message')
  );

  const created = [];
  let cross = null;

  const result = {
    name,
    firebaseState,
    authenticated: true,
    modules: {}
  };

  try {
    await wait(500);

    const lead = await createRecord(page, 'leads', {
      fullName: 'E2E Lead ' + owner.uid.slice(0, 6),
      phone: '+201000000001',
      email: owner.email,
      source: 'E2E',
      insuranceType: 'Motor',
      estimatedPremium: 12000,
      priority: 'hot',
      stage: 'New'
    });
    assert(lead.exists, name + ': lead create/read failed');
    created.push(['leads', lead.id]);
    const leadUpdated = await updateRecord(page, 'leads', lead.id, {
      stage: 'Qualified',
      e2eWorkflow: 'lead-to-opportunity'
    });
    assert(leadUpdated.data.stage === 'Qualified', name + ': lead update failed');
    result.modules.leads = {
      create: true,
      update: true,
      stage: leadUpdated.data.stage
    };

    const opportunity = await createRecord(page, 'opportunities', {
      sourceLeadId: lead.id,
      customerName: lead.data.fullName,
      customerId: null,
      phone: lead.data.phone,
      email: lead.data.email,
      insuranceType: lead.data.insuranceType,
      product: 'Motor Comprehensive',
      insurer: 'E2E Insurer',
      coverage: 'Comprehensive',
      sumInsured: 300000,
      estimatedPremium: 12000,
      expectedCommission: 1200,
      priority: 'hot',
      closingDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'New'
    });
    assert(opportunity.exists, name + ': opportunity create/read failed');
    created.push(['opportunities', opportunity.id]);
    const oppUpdated = await updateRecord(page, 'opportunities', opportunity.id, {
      status: 'Quotation'
    });
    assert(oppUpdated.data.status === 'Quotation', name + ': opportunity update failed');
    result.modules.opportunities = {
      create: true,
      update: true,
      status: oppUpdated.data.status,
      sourceLeadId: lead.id
    };

    const quotation = await createRecord(page, 'quotations', {
      opportunityId: opportunity.id,
      customerId: null,
      customerName: lead.data.fullName,
      phone: lead.data.phone,
      email: lead.data.email,
      insuranceType: 'Motor',
      product: 'Motor Comprehensive',
      insurer: 'E2E Insurer',
      coverage: 'Comprehensive',
      sumInsured: 300000,
      premium: 12000,
      deductible: 5000,
      commissionAmount: 1200,
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'Draft'
    });
    assert(quotation.exists, name + ': quotation create/read failed');
    created.push(['quotations', quotation.id]);
    const quoteUpdated = await updateRecord(page, 'quotations', quotation.id, {
      status: 'Accepted'
    });
    assert(quoteUpdated.data.status === 'Accepted', name + ': quotation update failed');
    result.modules.quotations = {
      create: true,
      update: true,
      status: quoteUpdated.data.status,
      opportunityId: opportunity.id
    };

    const policy = await createRecord(page, 'policies', {
      quotationId: quotation.id,
      policyNumber: 'E2E-' + Date.now(),
      customerId: null,
      customerName: lead.data.fullName,
      phone: lead.data.phone,
      email: lead.data.email,
      insurer: 'E2E Insurer',
      product: 'Motor Comprehensive',
      insuranceType: 'Motor',
      coverage: 'Comprehensive',
      sumInsured: 300000,
      premium: 12000,
      startDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      commissionRate: 10,
      commissionAmount: 1200,
      paymentStatus: 'pending',
      status: 'Active'
    });
    assert(policy.exists, name + ': policy create/read failed');
    created.push(['policies', policy.id]);
    const policyUpdated = await updateRecord(page, 'policies', policy.id, {
      status: 'Renewed'
    });
    assert(policyUpdated.data.status === 'Renewed', name + ': policy update failed');
    result.modules.policies = {
      create: true,
      update: true,
      policyNumber: policy.data.policyNumber,
      quotationId: quotation.id
    };

    const renewal = await createRecord(page, 'renewals', {
      policyId: policy.id,
      policyNumber: policy.data.policyNumber,
      customerId: null,
      customerName: lead.data.fullName,
      phone: lead.data.phone,
      email: lead.data.email,
      insurer: 'E2E Insurer',
      expiryDate: policy.data.expiryDate,
      stage: '90 Days',
      status: 'Open',
      assignedBrokerName: 'E2E Broker',
      notes: 'E2E renewal workflow'
    });
    assert(renewal.exists, name + ': renewal create/read failed');
    created.push(['renewals', renewal.id]);
    const renewalUpdated = await updateRecord(page, 'renewals', renewal.id, {
      status: 'In Progress',
      stage: '30 Days'
    });
    assert(renewalUpdated.data.status === 'In Progress', name + ': renewal update failed');
    result.modules.renewals = {
      create: true,
      update: true,
      status: renewalUpdated.data.status,
      policyId: policy.id
    };

    const claim = await createRecord(page, 'claims', {
      policyId: policy.id,
      claimNumber: 'CLM-E2E-' + Date.now(),
      customerId: null,
      customerName: lead.data.fullName,
      policyNumber: policy.data.policyNumber,
      insurer: 'E2E Insurer',
      claimType: 'Motor',
      dateOfLoss: new Date().toISOString().slice(0, 10),
      amount: 35000,
      status: 'Reported',
      description: 'E2E claim workflow'
    });
    assert(claim.exists, name + ': claim create/read failed');
    created.push(['claims', claim.id]);
    const claimUpdated = await updateRecord(page, 'claims', claim.id, {
      status: 'Under Review'
    });
    assert(claimUpdated.data.status === 'Under Review', name + ': claim update failed');
    result.modules.claims = {
      create: true,
      update: true,
      status: claimUpdated.data.status,
      policyId: policy.id
    };

    const team = await createRecord(page, 'teams', {
      name: 'E2E Team ' + owner.uid.slice(0, 6),
      managerName: 'E2E Manager',
      description: 'E2E team workflow',
      status: 'active'
    });
    assert(team.exists, name + ': team create/read failed');
    created.push(['teams', team.id]);
    const teamUpdated = await updateRecord(page, 'teams', team.id, {
      status: 'inactive'
    });
    assert(teamUpdated.data.status === 'inactive', name + ': team update failed');
    result.modules.team = {
      create: true,
      update: true,
      status: teamUpdated.data.status
    };

    const payment = await createRecord(page, 'payments', {
      policyId: policy.id,
      policyNumber: policy.data.policyNumber,
      customerId: null,
      customerName: lead.data.fullName,
      amount: 1000,
      date: new Date().toISOString().slice(0, 10),
      method: 'Bank transfer',
      status: 'paid'
    });
    assert(payment.exists, name + ': payment create/read failed');
    created.push(['payments', payment.id]);
    const paymentUpdated = await updateRecord(page, 'payments', payment.id, {
      status: 'partial'
    });
    assert(paymentUpdated.data.status === 'partial', name + ': payment update failed');
    result.modules.payments = {
      create: true,
      update: true,
      status: paymentUpdated.data.status,
      policyId: policy.id
    };

    result.modules.subscriptions = await expectPermissionDenied(page, 'subscriptions', {
      plan: 'Professional',
      status: 'active',
      renewalDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      customerLimit: 100,
      userLimit: 10
    });
    assert(
      result.modules.subscriptions.ok,
      name + ': subscriptions unexpectedly allowed personal-workspace creation'
    );

    cross = await createDisposableUser(page, 'insurnex-crm-e2e-cross');
    await assert(
      cross.ok,
      name +
        ': could not create cross-workspace test user (' +
        (cross.code || 'unknown') +
        '): ' +
        (cross.message || 'no message')
    );

    await assert(
      (await signIn(page, cross.email, cross.password)).ok,
      name + ': cross-workspace user sign-in failed'
    );

    const isolation = await page.evaluate(async id => {
      try {
        const app = window.firebase.apps.find(x => x.name === 'insurnexE2E');
        await app.firestore().collection('leads').doc(id).get({ source: 'server' });
        return { isolated: false, code: 'read-allowed' };
      } catch (error) {
        return {
          isolated: error.code === 'permission-denied',
          code: error.code || '',
          message: error.message || String(error)
        };
      }
    }, lead.id);

    assert(isolation.isolated, name + ': workspace isolation failed for leads');
    result.crossWorkspaceIsolation = isolation;

    await assert(
      (await signIn(page, owner.email, owner.password)).ok,
      name + ': owner re-authentication failed after isolation check'
    );

    for (const [collection, id] of [...created].reverse()) {
      const deleted = await deleteRecord(page, collection, id);
      assert(deleted.deleted, name + ': cleanup failed for ' + collection + '/' + id);
    }

    await page.evaluate(() => window.firebase.auth().signOut().catch(() => {}));
    const cleanupPage = await context.newPage();
    await cleanupPage.goto(BASE_URL + '#login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    if (cross) {
      const crossLogin = await signIn(cleanupPage, cross.email, cross.password);
      if (crossLogin.ok) await deleteCurrentAuthUser(cleanupPage);
    }
    await cleanupPage.close();

    await assert(
      (await signIn(page, owner.email, owner.password)).ok,
      name + ': owner re-authentication failed before account cleanup'
    );
    await deleteCurrentAuthUser(page);
  } finally {
    try {
      await deleteCurrentAuthUser(page);
    } catch (_) {}
    await context.close();
  }

  await assert(
    pageErrors.length === 0,
    name + ': unexpected page errors: ' + JSON.stringify(pageErrors)
  );

  if (name === 'mobile') {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    await assert(!overflow, name + ': horizontal overflow detected');
  }

  return {
    ...result,
    consoleErrors,
    pageErrors
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const desktop = await runContext(browser, 'desktop', {
      viewport: { width: 1440, height: 900 },
      isMobile: false
    });

    const mobile = await runContext(browser, 'mobile', {
      ...devices['iPhone 13']
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          suite: 'crm-business-workflow',
          authenticatedSuite: true,
          desktop,
          mobile,
          coverage: [
            'Leads',
            'Opportunities',
            'Quotations',
            'Policies',
            'Renewals',
            'Claims',
            'Payments',
            'Subscription',
            'Team',
            'Cross-workspace isolation'
          ]
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
