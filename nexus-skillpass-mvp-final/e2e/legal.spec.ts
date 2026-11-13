import { expect, test } from '@playwright/test';
import { enterDemo, watchConsole } from './helpers';

/*
 * Privacy notice and terms (migration 20261113000001). The web server of this suite runs with a fictional
 * LEGAL_* entity (playwright.config.ts), so the texts are live; against an external deployment they may not be.
 */
test.skip(!!process.env.E2E_BASE_URL, 'needs the LEGAL_* values of the local web server');

test('the privacy notice and the terms are public pages, linked from the footer and from each other', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Aviso de privacidad' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' })).toBeVisible();
  await expect(page.getByText('Versión del 13 de noviembre de 2026')).toBeVisible();
  await expect(page.locator('main section')).toHaveCount(12);
  await expect(page.getByText('AINDEV E2E, S.A. de C.V. («AINDEV»), con domicilio en Av. de Prueba 100')).toBeVisible();
  await expect(page.getByRole('link', { name: 'privacidad@aindev.invalid' })).toHaveAttribute('href', 'mailto:privacidad@aindev.invalid');

  await page.getByRole('main').getByRole('link', { name: 'Términos y condiciones' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Términos y condiciones' })).toBeVisible();
  await expect(page.locator('main section')).toHaveCount(14);
  await expect(page.getByText('tribunales competentes de Aguascalientes, Aguascalientes')).toBeVisible();
  // The contents list jumps to each section.
  await page.getByRole('navigation', { name: 'Contenido' }).getByRole('link', { name: '6. Validación y credenciales' }).click();
  await expect(page).toHaveURL(/\/legal\/terms#credenciales$/);
  expect(errors).toEqual([]);
});

test('the English pages say they are a courtesy translation', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'sp_locale', value: 'en', url: baseURL! }]);
  await page.goto('/legal/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
  await expect(page.getByText('This is a courtesy translation. The Spanish text is the legally valid one.')).toBeVisible();
  await expect(page.locator('main section')).toHaveCount(12);
});

test('sign-up asks to read the privacy notice and accept the terms', async ({ page }) => {
  await page.goto('/signup');
  const consent = page.getByRole('checkbox', { name: /He leído el Aviso de privacidad y acepto los Términos y condiciones/ });
  await expect(consent).toBeVisible();
  await expect(consent).toHaveAttribute('required', '');
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole('main').getByRole('link', { name: 'Aviso de privacidad' })).toHaveAttribute('href', '/legal/privacy');
  await expect(page.getByRole('main').getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute('href', '/legal/terms');

  // The browser stops the form until the box is ticked.
  await page.getByLabel('Nombre completo').fill('Persona de Prueba');
  await page.getByLabel('Correo electrónico').fill('persona@example.com');
  await page.getByLabel('Contraseña').fill('una-contraseña-larga');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  expect(await consent.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await expect(page).toHaveURL(/\/signup$/);
});

test('the acceptance screen needs a session, and DEMO personas are never asked', async ({ page }) => {
  await page.goto('/legal/accept');
  await expect(page).toHaveURL(/\/login\?next=%2Flegal%2Faccept/);
  await enterDemo(page, 'student');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/legal/accept?next=/notifications');
  await expect(page).toHaveURL(/\/notifications$/);
  // The texts stay one click away inside the platform.
  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await expect(page.getByRole('menuitem', { name: 'Aviso de privacidad' })).toBeVisible();
});
