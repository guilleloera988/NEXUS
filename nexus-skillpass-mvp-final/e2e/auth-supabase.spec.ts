import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

/*
 * Real account lifecycle against a Supabase backend (local `supabase start` or a staging project).
 * Runs only with E2E_SUPABASE=1 because the embedded DEMO has no Auth service.
 * Requires e-mail confirmation to be disabled in that Auth instance (default for local Supabase).
 */
test.skip(!process.env.E2E_SUPABASE, 'requires a Supabase backend (E2E_SUPABASE=1)');

const password = 'Una-clave-de-prueba-2026';

test('student signs up, completes onboarding, signs out and signs back in', async ({ page }) => {
  const errors = watchConsole(page);
  const email = `e2e.student.${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.locator('label').filter({ hasText: 'Estudiante' }).first().click();
  await page.getByLabel('Nombre completo').fill('Estudiante E2E');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel('Carrera').fill('Ingeniería Industrial');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText('Estudiante E2E').first()).toBeVisible();

  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/);
  expect(errors).toEqual([]);
});

test('a new company stays pending verification and cannot publish', async ({ page }) => {
  const email = `e2e.company.${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.locator('label').filter({ hasText: 'Empresa' }).first().click();
  await page.getByLabel('Nombre completo').fill('Empresa E2E');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel('Nombre de la empresa').fill(`Empresa de prueba E2E ${Date.now()}`);
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto('/organization');
  await expect(page.getByText('Pendiente de verificación').first()).toBeVisible();
  await page.goto('/challenges/new');
  await expect(page.getByRole('button', { name: 'Publicar y abrir convocatoria' })).toHaveCount(0);
});

test('wrong credentials show a generic error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('nadie@example.com');
  await page.getByLabel('Contraseña').fill('contraseña-incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Correo o contraseña incorrectos', { exact: false })).toBeVisible();
});
