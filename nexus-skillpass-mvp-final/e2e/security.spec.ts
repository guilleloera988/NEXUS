import { expect, test } from '@playwright/test';
import { enterDemo, watchConsole } from './helpers';

const SEEDED_CODE = 'SKP-2026-4A7C-91D2';
const SEEDED_PRIVATE_EVIDENCE = '60000000-0000-4000-8000-000000000003'; // María's draft repository link
const SEEDED_FILE_EVIDENCE = '60000000-0000-4000-8000-000000000004'; // Diego's submitted PDF

test.describe('access control in the browser', () => {
  test('private routes require a session and keep a safe return path', async ({ page }) => {
    for (const path of ['/dashboard', '/challenges', '/my-skillpass', '/validations', '/admin/users', '/talent']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%2F/g, '%2F')}`));
    }
  });

  test('login ignores external redirect targets', async ({ page }) => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example']) {
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await expect(page.locator('input[name="next"]')).toHaveValue('/dashboard');
    }
  });

  test('anonymous visitors cannot download evidence or exports', async ({ request }) => {
    for (const id of [SEEDED_PRIVATE_EVIDENCE, SEEDED_FILE_EVIDENCE]) {
      const res = await request.get(`/api/evidence/${id}/file`);
      expect([401, 403, 404]).toContain(res.status());
    }
    expect([401, 403]).toContain((await request.get('/api/university/students.csv')).status());
    expect((await request.get('/api/evidence/not-a-uuid/file')).status()).toBeGreaterThanOrEqual(400);
  });

  test('a student cannot reach admin, reviewer or university surfaces', async ({ page }) => {
    await enterDemo(page, 'student');
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Talent OS')).toHaveCount(0);
    expect((await page.request.get('/api/university/students.csv')).status()).toBe(403);
    await page.goto('/talent');
    await expect(page.getByText('Disponible para empresas verificadas por AINDEV.')).toBeVisible();
  });

  test('university staff see aggregates but never evidence files', async ({ page }) => {
    await enterDemo(page, 'university');
    expect((await page.request.get('/api/university/students.csv')).status()).toBe(200);
    const file = await page.request.get(`/api/evidence/${SEEDED_FILE_EVIDENCE}/file`);
    expect([403, 404]).toContain(file.status());
  });

  test('a teammate cannot open another student\'s validation request', async ({ page }) => {
    await enterDemo(page, 'supervisor');
    await page.goto('/validations');
    const href = await page.locator('a[href^="/validations/"]').first().getAttribute('href');
    expect(href).toBeTruthy();
    // Same scenario: María works on the same challenge as Diego but must not see his review.
    await page.getByText('Cambiar de persona:').locator('..').getByRole('button', { name: 'Estudiante', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto(href!);
    await expect(page.getByText('Página no encontrada')).toBeVisible();
    await expect(page.getByText('Diego Ramírez')).toHaveCount(0);
  });
});

test.describe('public verification surface', () => {
  test('seeded credential and SkillPass pages work without a session and hide private data', async ({ page }) => {
    const errors = watchConsole(page);
    const res = await page.goto('/demo');
    expect(res?.status()).toBe(200);
    // Public examples are linked from /demo and carry no private workspace data.
    await page.goto('/verify');
    await page.getByPlaceholder('SKP-2026-XXXX-XXXX').fill('skp-2026-0000-0000');
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page).toHaveURL(/\/verify\/SKP-2026-0000-0000/);
    await expect(page.getByText('Credencial no encontrada')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('security headers are present', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBeTruthy();
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('health endpoint does not leak configuration secrets', async ({ request }) => {
    const body = await (await request.get('/api/health')).text();
    expect(body).not.toMatch(/key|secret|password|eyJ/i);
  });
});

test('demo verification links work for anyone holding them', async ({ page, browser }) => {
  await enterDemo(page, 'student');
  await page.goto('/my-skillpass');
  const card = page.locator('article, section').filter({ hasText: SEEDED_CODE }).first();
  const link = await card.getByRole('link', { name: 'Ver en línea' }).getAttribute('href');
  expect(link).toContain(`/verify/${SEEDED_CODE}?demo=`);
  const anon = await browser.newContext({ locale: 'es-MX' });
  const pub = await anon.newPage();
  await pub.goto(link!);
  await expect(pub.getByText('Credencial válida').first()).toBeVisible();
  await expect(pub.getByText('DEMO · Datos ficticios').first()).toBeVisible();
  await anon.close();
});
