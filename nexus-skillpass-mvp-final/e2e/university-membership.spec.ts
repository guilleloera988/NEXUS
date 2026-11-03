import { expect, test, type Page } from '@playwright/test';
import { enterDemo, switchTo, watchConsole } from './helpers';

/*
 * Pilot readiness: a student is linked to a university only once the link is verified, by an institutional
 * e-mail domain or by the university's staff. Demo accounts use @demo.skillpass.invalid, so María's choice
 * becomes a request that Dra. Elena (Demo University) approves; adding that domain links students at once.
 */
// Needs migration 20261103000001 and writes data: never run it against the shared Supabase demo.
test.skip(!!process.env.E2E_SUPABASE, 'requires the embedded DEMO with migration 20261103000001');

const DEMO_UNIVERSITY = 'Demo University';
const DEMO_UNIVERSITY_OPTION = 'Demo University · Campus Centro';

async function chooseUniversity(page: Page, label: string) {
  await page.goto('/profile?edit=1');
  await page.getByLabel('Universidad', { exact: true }).selectOption({ label });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cambios guardados.' })).toBeVisible();
}

test('a student choice waits for the university, which approves it from its dashboard', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  await enterDemo(page, 'student');

  // María is linked by the seed. Leaving the university and choosing it again turns the link into a request.
  await chooseUniversity(page, 'Mi universidad no aparece / prefiero no vincularla');
  await chooseUniversity(page, DEMO_UNIVERSITY_OPTION);
  await page.goto('/profile?edit=1');
  await expect(page.getByText(`Solicitud enviada a ${DEMO_UNIVERSITY}.`)).toBeVisible();
  await expect(page.getByLabel('Universidad', { exact: true })).toHaveValue('20000000-0000-4000-8000-000000000002');

  await switchTo(page, 'university');
  const requests = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Solicitudes de estudiantes (1)' }) });
  await expect(requests).toContainText('María Torres');
  await expect(requests).toContainText('maria.torres@demo.skillpass.invalid');
  await requests.getByRole('button', { name: 'Aprobar: María Torres' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitudes de estudiantes (0)' })).toBeVisible();
  await expect(page.getByText('No hay solicitudes pendientes.')).toBeVisible();
  await expect(page.getByRole('row', { name: /María Torres/ })).toBeVisible();

  await switchTo(page, 'student');
  await page.goto('/profile?edit=1');
  await expect(page.getByText('Tu universidad confirmó tu vinculación.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('university managers set institutional domains; public mail providers are refused', async ({ page }) => {
  test.setTimeout(240_000);
  await enterDemo(page, 'university');
  await page.goto('/organization');
  const field = page.getByLabel('Dominios');
  await field.fill('gmail.com');
  await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ese dominio no se puede registrar' })).toBeVisible();

  await field.fill('@Demo.SkillPass.invalid');
  await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
  await expect(page.getByRole('status').filter({ hasText: 'Dominios guardados.' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Dominios')).toHaveValue('demo.skillpass.invalid');

  // With the domain in place, a student who chooses the university is linked at once.
  await switchTo(page, 'student');
  await chooseUniversity(page, 'Mi universidad no aparece / prefiero no vincularla');
  await chooseUniversity(page, DEMO_UNIVERSITY_OPTION);
  await page.goto('/profile?edit=1');
  await expect(page.getByText('Vinculación verificada con tu correo institucional.')).toBeVisible();

  // A removal sticks: saving the profile again does not bring the student back through the domain.
  await switchTo(page, 'university');
  await page.getByRole('button', { name: 'Quitar a María Torres' }).click();
  await page.getByRole('dialog', { name: 'Quitar a María Torres' }).getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByRole('row', { name: /María Torres/ })).toHaveCount(0);
  await switchTo(page, 'student');
  await chooseUniversity(page, DEMO_UNIVERSITY_OPTION);
  await page.goto('/profile?edit=1');
  await expect(page.getByText(`${DEMO_UNIVERSITY} retiró tu vinculación.`)).toBeVisible();

  // The university can still take her back from the refused list.
  await switchTo(page, 'university');
  await page.getByText('Rechazados o retirados (1)').click();
  await page.getByRole('button', { name: 'Aprobar: María Torres' }).click();
  await expect(page.getByRole('row', { name: /María Torres/ })).toBeVisible();
});
