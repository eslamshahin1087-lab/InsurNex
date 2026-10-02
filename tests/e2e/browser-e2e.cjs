const { chromium, devices } = require('playwright');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/InsurNex-User.html';
const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runContext(browser, name, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
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
  await assert(legacyCount === 0, name + ': legacy SecurePath/Wathiqati references remain');

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

  const unexpectedPageErrors = pageErrors.filter(Boolean);
  await assert(unexpectedPageErrors.length === 0, name + ': unexpected browser page errors: ' + JSON.stringify(unexpectedPageErrors));

  if (hasCreds) {
    await page.goto(BASE_URL + '#login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('input[name="email"]').fill(process.env.E2E_EMAIL);
    await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD);
    await page.locator('.auth-submit').click();
    await page.waitForTimeout(2500);
    await assert(await page.locator('#view, #app .shell, .app-shell').count() > 0, name + ': authenticated shell did not load');

    for (const route of ['crm', 'leads', 'opportunities', 'quotations', 'policies', 'renewals', 'claims', 'documents', 'insurers', 'expenses', 'notifications']) {
      await page.evaluate(routeName => { location.hash = '#' + routeName; }, route);
      await page.waitForTimeout(500);
      await assert(await page.locator('#view').count() > 0, name + ': route container missing for ' + route);
    }
  }

  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  if (name === 'mobile') await assert(mobileOverflow, 'mobile: horizontal overflow detected');

  await context.close();
  return { name, firebaseState, anonymous, consoleErrors, pageErrors, authenticatedSuite: hasCreds };
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
      desktop,
      mobile,
      note: hasCreds
        ? 'Authenticated E2E executed using the supplied dedicated test account.'
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
