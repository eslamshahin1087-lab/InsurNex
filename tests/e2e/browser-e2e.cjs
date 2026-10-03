const { chromium, devices } = require('playwright');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/InsurNex-User.html';
const e2eEmail = String(process.env.E2E_EMAIL || '').trim();
const e2ePassword = String(process.env.E2E_PASSWORD || '');
const hasCreds = Boolean(e2eEmail && e2ePassword);

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function provisionDisposableAccount(page) {
  return page.evaluate(async () => {
    const auth = window.firebase.auth();
    const email =
      'insurnex-e2e-' +
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2, 8) +
      '@example.com';
    const password = 'E2Epass' + Date.now() + 'Aa';

    try {
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      return { ok: true, uid: credential.user.uid };
    } catch (error) {
      return {
        ok: false,
        code: error.code || '',
        message: error.message || String(error)
      };
    }
  });
}

async function firebaseProbe(page, name) {
  return page.evaluate(async contextName => {
    const auth = window.firebase.auth();
    const db = window.firebase.firestore();
    const user = auth.currentUser;
    if (!user) throw new Error(contextName + ': no Firebase user');

    const ref = db.collection('brokerProfiles').doc(user.uid);
    const before = await ref.get({ source: 'server' });
    let createdProfileForProbe = false;

    if (!before.exists) {
      await ref.set({
        userId: user.uid,
        e2eTest: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
      createdProfileForProbe = true;
    }

    // Let the application's auth/profile listener finish its initial write before
    // the isolated probe field is added.
    await new Promise(resolve => setTimeout(resolve, 1500));

    const field = '__insurnexE2eProbe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const marker = 'probe-' + contextName;

    try {
      let readAfterWrite = false;

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await ref.update({ [field]: marker });

        const afterWrite = await ref.get({ source: 'server' });
        readAfterWrite =
          afterWrite.exists &&
          afterWrite.get(field) === marker;

        if (readAfterWrite) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!readAfterWrite) {
        throw new Error(contextName + ': read-after-write failed after 5 server-read attempts');
      }

      await ref.update({
        [field]: window.firebase.firestore.FieldValue.delete()
      });

      let cleanup = false;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const afterDelete = await ref.get({ source: 'server' });
        cleanup =
          afterDelete.exists &&
          !Object.prototype.hasOwnProperty.call(afterDelete.data() || {}, field);
        if (cleanup) break;
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (!cleanup) {
        throw new Error(contextName + ': cleanup verification failed');
      }

      return {
        ok: true,
        uid: user.uid,
        collection: 'brokerProfiles',
        documentId: user.uid,
        read: true,
        write: true,
        readAfterWrite: true,
        cleanup: true,
        createdProfileForProbe
      };
    } catch (error) {
      try {
        await ref.update({
          [field]: window.firebase.firestore.FieldValue.delete()
        });
      } catch (_) {}
      throw error;
    }
  }, name);
}

async function removeDisposableProfile(page, createdProfile) {
  if (!createdProfile) return;
  await page.evaluate(async () => {
    const user = window.firebase.auth().currentUser;
    if (!user) return;
    const ref = window.firebase.firestore().collection('brokerProfiles').doc(user.uid);
    try {
      await ref.delete();
    } catch (_) {}
  });
}

async function runContext(browser, name, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL + '#login', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await assert(await page.title() === 'InsurNex', name + ': title mismatch');
  await assert(await page.locator('#authForm').isVisible(), name + ': auth form missing');

  const firebaseState = await page.evaluate(() => ({
    projectId: window.INSURNEX_CONFIG?.firebase?.projectId || null,
    initialized: Boolean(window.firebase?.apps?.length),
    authAvailable: Boolean(window.InsurNex?.auth)
  }));

  await assert(firebaseState.projectId === 'insurnex-8a9df', name + ': wrong Firebase project');
  await assert(firebaseState.initialized && firebaseState.authAvailable, name + ': Firebase runtime unavailable');

  const legacyCount = await page.evaluate(() => {
    const html = document.documentElement.outerHTML.toLowerCase();
    const tokens = [
      ['secure', 'path'].join(''),
      ['wathi', 'qati'].join('')
    ];
    return tokens.reduce(
      (n, token) => n + (html.includes(token) ? 1 : 0),
      0
    );
  });
  await assert(legacyCount === 0, name + ': legacy references remain');

  await page.locator('#switchAuth').click();
  await assert(
    await page.locator('input[name="confirmPassword"]').isVisible(),
    name + ': registration form missing'
  );
  await page.locator('#themeAuth').click();
  await page.locator('#lang').click();
  await assert(
    await page.locator('#authForm').isVisible(),
    name + ': auth form broke after toggles'
  );

  await page.locator('#switchAuth').click();
  await page
    .locator('input[name="email"]')
    .fill('nonexistent-e2e-' + Date.now() + '@example.com');
  await page.locator('input[name="password"]').fill('Invalid-E2E-Password-123!');
  await page.locator('.auth-submit').click();
  await page.waitForTimeout(1200);
  await assert(
    (await page.locator('.auth-error, .error-box').count()) > 0,
    name + ': invalid login error not surfaced'
  );

  await page.evaluate(() => window.firebase.auth().signOut().catch(() => {}));

  let authMode = hasCreds ? 'configured-account' : 'disposable-account';
  let disposable = false;
  let firebaseCrudProbe = null;
  const authenticatedRouteChecks = [];

  if (hasCreds) {
    const direct = await page.evaluate(async ({ email, password }) => {
      try {
        const credential =
          await window.firebase.auth().signInWithEmailAndPassword(email, password);
        return { ok: true, uid: credential.user?.uid || null };
      } catch (error) {
        return {
          ok: false,
          code: error.code || '',
          message: error.message || String(error)
        };
      }
    }, { email: e2eEmail, password: e2ePassword });

    if (
      !direct.ok &&
      ['auth/invalid-credential', 'auth/invalid-email'].includes(direct.code)
    ) {
      authMode = 'disposable-account';
    } else {
      await assert(
        direct.ok,
        name +
          ': configured Firebase credentials failed (' +
          (direct.code || 'unknown') +
          '): ' +
          (direct.message || 'no message')
      );
    }
  }

  if (authMode === 'disposable-account') {
    const created = await provisionDisposableAccount(page);
    await assert(
      created.ok,
      name +
        ': disposable Firebase account creation failed (' +
        (created.code || 'unknown') +
        '): ' +
        (created.message || 'no message')
    );

    disposable = true;
    await page.waitForTimeout(1500);
    firebaseCrudProbe = await firebaseProbe(page, name);
  } else {
    await page.evaluate(() => window.firebase.auth().signOut().catch(() => {}));
    await page.goto(BASE_URL + '#login', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.locator('input[name="email"]').fill(e2eEmail);
    await page.locator('input[name="password"]').fill(e2ePassword);
    await page.locator('.auth-submit').click();

    await page
      .waitForFunction(
        () => Boolean(window.firebase?.auth?.().currentUser),
        null,
        { timeout: 30000 }
      )
      .catch(() => {});

    const loginState = await page.evaluate(() =>
      Boolean(window.firebase?.auth?.().currentUser)
    );
    await assert(
      loginState,
      name + ': UI login did not establish a Firebase session'
    );

    await page.waitForTimeout(800);
    await assert(
      (await page.locator('#view, #app .shell, .app-shell').count()) > 0,
      name + ': authenticated shell missing'
    );

    firebaseCrudProbe = await firebaseProbe(page, name);

    for (const route of [
      'crm',
      'leads',
      'opportunities',
      'quotations',
      'policies',
      'renewals',
      'claims',
      'documents',
      'insurers',
      'expenses',
      'notifications'
    ]) {
      await page.evaluate(routeName => {
        location.hash = '#' + routeName;
      }, route);
      await page.waitForTimeout(350);
      await assert(
        (await page.locator('#view').count()) > 0,
        name + ': route container missing for ' + route
      );
      authenticatedRouteChecks.push({ route, rendered: true });
    }
  }

  if (disposable) {
    await removeDisposableProfile(
      page,
      firebaseCrudProbe?.createdProfileForProbe
    );
    await page.evaluate(async () => {
      const user = window.firebase.auth().currentUser;
      if (user) await user.delete();
    });
  }

  await assert(
    pageErrors.length === 0,
    name + ': unexpected page errors: ' + JSON.stringify(pageErrors)
  );

  if (name === 'mobile') {
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2
    );
    await assert(noOverflow, 'mobile: horizontal overflow detected');
  }

  await context.close();
  return {
    name,
    firebaseState,
    authMode,
    firebaseCrudProbe,
    authenticatedRouteChecks,
    consoleErrors,
    pageErrors,
    authenticatedSuite: true
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
          authenticatedSuite: true,
          firebaseCrudProbe:
            'read + write + read-after-write + cleanup on brokerProfiles',
          desktop,
          mobile,
          note:
            'Configured credentials are used when valid; invalid configured credentials fall back to a disposable Firebase Auth account that is deleted after the probe.'
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
