const { chromium, devices } = require('playwright');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/InsurNex-User.html';
const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runAuthenticatedFirebaseProbe(page, name) {
  return page.evaluate(async (contextName) => {
    const auth = window.firebase.auth();
    const db = window.firebase.firestore();
    const user = auth.currentUser;
    if (!user) throw new Error(contextName + ': Firebase authenticated user missing');

    // Uses a unique temporary field on the signed-in user's own profile. It never
    // creates, edits, or deletes customer/business records.
    const profileRef = db.collection('users').doc(user.uid);
    const profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists) {
      throw new Error(contextName + ': users/' + user.uid + ' does not exist; account provisioning is incomplete');
    }

    const probeField = '__insurnexE2eProbe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const marker = 'probe-' + contextName + '-' + user.uid;
    let writeConfirmed = false;
    let readConfirmed = false;
    let cleanupConfirmed = false;

    try {
      await profileRef.update({ [probeField]: marker });
      writeConfirmed = true;

      const afterWrite = await profileRef.get();
      readConfirmed = afterWrite.exists && afterWrite.get(probeField) === marker;
      if (!readConfirmed) throw new Error(contextName + ': Firestore read-after-write verification failed');

      await profileRef.update({ [probeField]: window.firebase.firestore.FieldValue.delete() });
      const afterCleanup = await profileRef.get();
      cleanupConfirmed = afterCleanup.exists && !Object.prototype.hasOwnProperty.call(afterCleanup.data() || {}, probeField);
      if (!cleanupConfirmed) throw new Error(contextName + ': temporary Firebase probe field cleanup could not be verified');

      return {
        ok: true,
        uid: user.uid,
        collection: 'users',
        documentId: user.uid,
        read: true,
        write: writeConfirmed,
        readAfterWrite: readConfirmed,
        cleanup: cleanupConfirmed
      };
    } catch (error) {
      // Best-effort cleanup only targets the uniquely named field created above.
      try {
        await profileRef.update({ [probeField]: window.firebase.firestore.FieldValue.delete() });
      } catch (_) {}
      throw new Error(contextName + ': authenticated Firebase probe failed (' + (error.code || 'unknown') + '): ' + (error.message || String(error)));
    }
  }, name);
}

async function runContext(browser, name, options) {
  const context = await browser.newContext(options);
  let page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(String(err)));

  await page.goto(BASE_URL + '#login', { waitUntil: 'networkidle', timeout: 60000 });
  await assert((await page.title()) === 'InsurNex', name + ': title mismatch');
  await assert(await page.locator('#authForm').isVisible(), name + ': auth form not visible');

  const firebaseState = await page.evaluate(() => ({
    projectId: window.INSURNEX_CONFIG?.firebase?.projectId || null,
    initialized: Boolean(window.firebase?.apps?.length),
    authAvailable: Boolean(window.InsurNex?.auth)
  }));
  await assert(firebaseState.projectId === 'insurnex-8a9df', name + ': wrong Firebase project');
  await assert(firebaseState.initialized && firebaseState.authAvailable, name + ': Firebase runtime unavailable');

  const legacyCount = await page.evaluate(() => {
    const html = document.documentElement.outerHTML.toLowerCase();
    const needles = [['secure','path'].join(''), ['wathi','qati'].join('')];
    return needles.reduce((count, needle) => count + (html.match(new RegExp(needle, 'g')) || []).length, 0);
  });
  await assert(legacyCount === 0, name + ': legacy references remain');

  await page.locator('#switchAuth').click();
  await assert(await page.locator('input[name="confirmPassword"]').isVisible(), name + ': registration form did not open');
  await page.locator('#themeAuth').click();
  await page.locator('#lang').click();
  await assert(await page.locator('#authForm').isVisible(), name + ': auth form broke after theme/language toggle');

  await page.locator('#switchAuth').click();
  const email = 'nonexistent-e2e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@example.com';
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('Invalid-E2E-Password-123!');
  await page.locator('.auth-submit').click();
  await page.waitForTimeout(1500);
  const errorVisible = await page.locator('.auth-error, .error-box').count() > 0;
  await assert(errorVisible, name + ': Firebase invalid-login error was not surfaced');

  const anonymous = await page.evaluate(async () => {
    try {
      const credential = await window.firebase.auth().signInAnonymously();
      const uid = credential.user.uid;
      await credential.user.delete();
      return { ok: true, deleted: true, uid };
    } catch (e) {
      return { ok: false, code: e.code || '', message: e.message || '' };
    }
  });

  let firebaseCrudProbe = null;
  let authenticatedRouteChecks = [];
  if (hasCreds) {
    // First prove the supplied credentials work directly against the same
    // Firebase project. This gives us the real Firebase Auth error instead of
    // relying on UI state while diagnosing credentials/network problems.
    await page.evaluate(() => window.firebase.auth().signOut().catch(() => {}));
    const directLogin = await page.evaluate(async ({ email, password }) => {
      const auth = window.firebase.auth();
      try {
        await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        const credential = await auth.signInWithEmailAndPassword(email, password);
        return { ok: true, uid: credential.user?.uid || null };
      } catch (error) {
        return { ok: false, code: error.code || '', message: error.message || String(error) };
      }
    }, { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD });
    await assert(directLogin.ok,
      name + ': direct Firebase Auth login failed (' + (directLogin.code || 'unknown') + '): ' +
      (directLogin.message || 'no Firebase error message') +
      '; project=insurnex-8a9df');
    await page.waitForFunction(() => Boolean(window.firebase?.auth?.().currentUser), null, { timeout: 30000 });
    await assert(Boolean(await page.evaluate(() => window.firebase.auth().currentUser)),
      name + ': Firebase reported successful sign-in but currentUser is still empty');

    // Now verify the actual InsurNex login form against the same known-good
    // credentials, on a clean page, so a passing backend login cannot hide a UI
    // regression.
    await page.evaluate(() => window.firebase.auth().signOut().catch(() => {}));
    await page.goto(BASE_URL + '#login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('input[name="email"]').fill(process.env.E2E_EMAIL);
    await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD);
    await page.locator('.auth-submit').click();

    await page.waitForFunction(() => {
      const user = Boolean(window.firebase?.auth?.().currentUser);
      const error = [...document.querySelectorAll('.auth-error, .error-box')]
        .some(node => (node.textContent || '').trim().length > 0);
      return user || error;
    }, null, { timeout: 30000 }).catch(() => {});
    const loginState = await page.evaluate(() => ({
      authenticated: Boolean(window.firebase?.auth?.().currentUser),
      error: [...document.querySelectorAll('.auth-error, .error-box')]
        .map(node => (node.textContent || '').trim()).filter(Boolean).join(' | '),
      url: location.href
    }));
    await assert(loginState.authenticated,
      name + ': InsurNex UI login failed after direct Firebase authentication succeeded; UI error: ' +
      (loginState.error || 'no session and no visible auth error'));

    await page.waitForTimeout(1500);
    await assert(await page.locator('#view, #app .shell, .app-shell').count() > 0, name + ': authenticated shell did not load');

    firebaseCrudProbe = await runAuthenticatedFirebaseProbe(page, name);

    for (const route of ['crm', 'leads', 'opportunities', 'quotations', 'policies', 'renewals', 'claims', 'documents', 'insurers', 'expenses', 'notifications']) {
      await page.evaluate(routeName => { location.hash = '#' + routeName; }, route);
      await page.waitForTimeout(500);
      await assert(await page.locator('#view').count() > 0, name + ': route container missing for ' + route);
      authenticatedRouteChecks.push({ route, rendered: true });
    }
  }

  const unexpectedPageErrors = pageErrors.filter(Boolean);
  await assert(unexpectedPageErrors.length === 0, name + ': unexpected browser page errors: ' + JSON.stringify(unexpectedPageErrors));

  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  if (name === 'mobile') await assert(mobileOverflow, 'mobile: horizontal overflow detected');

  await context.close();
  return { name, firebaseState, anonymous, firebaseCrudProbe, authenticatedRouteChecks, consoleErrors, pageErrors, authenticatedSuite: hasCreds };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await runContext(browser, 'desktop', { viewport: { width: 1440, height: 900 }, isMobile: false });
    const mobile = await runContext(browser, 'mobile', { ...devices['iPhone 13'] });

    const result = {
      ok: true,
      baseUrl: BASE_URL,
      authenticatedSuite: hasCreds,
      firebaseCrudProbe: hasCreds ? 'read + write + read-after-write + cleanup on the signed-in user profile' : 'not run; configure INSURNEX_E2E_EMAIL and INSURNEX_E2E_PASSWORD',
      desktop,
      mobile,
      note: hasCreds
        ? 'Authenticated browser E2E and Firebase read/write verification executed using the supplied dedicated test account.'
        : 'Authenticated suite was not executed because no E2E_EMAIL/E2E_PASSWORD secrets were supplied.'
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
