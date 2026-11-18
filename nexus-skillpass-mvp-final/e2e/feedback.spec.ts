import { expect, test, type Locator } from '@playwright/test';
import { SAMPLE_PDF, enterDemo, switchTo, watchConsole } from './helpers';

/*
 * Product-owner feedback (October 2026): evidence names its task and deliverable, the "new version"
 * dialog scrolls in one place, drafts stay incomplete until published, and companies give a website.
 * Each test checks the browser rule and, by bypassing it, the server/database rule behind it.
 */
// Needs migration 20261015000001 and the current seed (company websites), and writes data: never run it
// against the shared Supabase demo.
test.skip(!!process.env.E2E_SUPABASE, 'requires the embedded DEMO with migration 20261015000001');

const SEEDED_CHALLENGE = '40000000-0000-4000-8000-000000000001'; // Commercial Process Automation: María is assigned
const SEEDED_TITLE = 'Commercial Process Automation';

const isInvalid = (field: Locator) => field.evaluate((el) => el.matches(':invalid'));
/** Simulates a crafted request: the browser no longer stops the form, so the server must. */
const dropRequired = (field: Locator) => field.evaluate((el) => el.removeAttribute('required'));

test('evidence is not saved until it names its task and its deliverable', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  const title = `Evidencia sin tarea ${Date.now().toString(36)}`;
  await enterDemo(page, 'student');
  await page.goto(`/workspace/${SEEDED_CHALLENGE}?tab=evidence`);
  const evidenceTab = page.getByRole('navigation', { name: SEEDED_TITLE }).getByRole('link', { name: /^Evidencias/ });
  const countBefore = (await evidenceTab.textContent())?.trim() ?? '';
  expect(countBefore).toMatch(/\d+$/);

  await page.getByRole('button', { name: 'Agregar evidencia' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar evidencia' });
  const save = dialog.getByRole('button', { name: 'Guardar' });
  const task = dialog.getByLabel('Tarea relacionada');
  const deliverable = dialog.getByLabel('Entregable relacionado');
  const fill = async () => {
    await dialog.getByLabel('Título').fill(title);
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'avance.pdf', mimeType: 'application/pdf', buffer: SAMPLE_PDF });
  };
  await fill();
  await expect(task).toHaveValue('');
  await expect(deliverable).toHaveValue('');

  // Native validation: neither the task nor the deliverable may stay on "Selecciona…".
  await save.click();
  await expect(dialog).toBeVisible();
  expect(await isInvalid(task)).toBe(true);
  expect(await isInvalid(deliverable)).toBe(true);
  await deliverable.selectOption({ label: 'Prototipo de automatización de cotizaciones' });
  await save.click();
  await expect(dialog).toBeVisible();
  expect(await isInvalid(deliverable)).toBe(false);
  expect(await isInvalid(task)).toBe(true);

  // Without the browser check the server refuses it too: first the task (zod), then the deliverable (sp_add_evidence).
  await dropRequired(task);
  await save.click();
  await expect(dialog.getByText('Completa el campo obligatorio: tarea relacionada.')).toBeVisible();
  await fill();
  await task.selectOption({ label: 'Construir el prototipo del cotizador' });
  // Choosing the task fills in the deliverable it belongs to.
  await expect(deliverable.locator('option:checked')).toHaveText('Prototipo de automatización de cotizaciones');
  await deliverable.selectOption('');
  await dropRequired(deliverable);
  await save.click();
  await expect(dialog.getByText('Completa el campo obligatorio: entregable relacionado.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await page.reload();
  await expect(page.getByText(title)).toHaveCount(0);
  await expect(evidenceTab).toHaveText(countBefore);

  // With both chosen, the same evidence is saved.
  await page.getByRole('button', { name: 'Agregar evidencia' }).click();
  await fill();
  await deliverable.selectOption({ label: 'Prototipo de automatización de cotizaciones' });
  await task.selectOption({ label: 'Construir el prototipo del cotizador' });
  await save.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(title)).toHaveCount(1);
  await expect(evidenceTab).toHaveText(countBefore.replace(/\d+$/, (n) => String(Number(n) + 1)));
  expect(errors).toEqual([]);
});

test('the "Subir nueva versión" dialog has a single scrollbar on a laptop screen', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1366, height: 657 });
  await enterDemo(page, 'student');
  await page.goto(`/workspace/${SEEDED_CHALLENGE}?tab=evidence`);
  await page.getByRole('button', { name: 'Subir nueva versión' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Subir nueva versión' });
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeAttached();
  const overflow = () => dialog.evaluate((d) => {
    const inner = d.firstElementChild as HTMLElement;
    return { dialog: d.scrollHeight - d.clientHeight, inner: inner.scrollHeight - inner.clientHeight };
  });
  // The form is taller than the dialog: its inner container scrolls, the <dialog> itself must not.
  let o = await overflow();
  expect(o.inner).toBeGreaterThan(0);
  expect(o.dialog).toBeLessThanOrEqual(0);
  // Same after scrolling down to the competency chips (sr-only checkboxes) and after a save stopped by validation.
  await dialog.evaluate((d) => { (d.firstElementChild as HTMLElement).scrollTop = d.firstElementChild!.scrollHeight; });
  o = await overflow();
  expect(o.dialog).toBeLessThanOrEqual(0);
  await dialog.getByLabel('Título').fill('');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeVisible();
  o = await overflow();
  expect(o.inner).toBeGreaterThan(0);
  expect(o.dialog).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('a draft saves incomplete but cannot be published until it is complete', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  const title = `Borrador E2E ${Date.now().toString(36)}`;
  await enterDemo(page, 'company');
  await page.goto('/challenges/new');
  await expect(page.getByText('Puedes guardar el borrador incompleto.')).toBeVisible();
  await expect(page.getByLabel(/^Ubicación/)).not.toHaveAttribute('required');
  await expect(page.locator('label').filter({ hasText: /^Ubicación/ })).toContainText('(necesario para publicar)');
  await page.getByLabel('Nombre del reto').fill(title);
  await page.getByLabel('Problema a resolver').fill('Los pedidos urgentes se priorizan a mano y nadie sabe qué se atrasó.');
  await page.getByLabel(/^Objetivo/).fill('Proponer un tablero de priorización de pedidos.');
  await expect(page.getByRole('button', { name: 'Publicar y abrir convocatoria' })).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.waitForURL(/\/challenges\/[0-9a-f-]{36}$/);

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Borrador').first()).toBeVisible();
  const checklist = page.getByRole('note').filter({ hasText: 'Para publicar, completa:' });
  await expect(checklist.getByRole('listitem')).toHaveText([
    'resumen', 'descripción', 'industria', 'ubicación', 'condiciones de participación', 'competencias', 'entregables', 'supervisor', 'fechas',
  ]);
  const toRecruiting = page.getByRole('button', { name: 'Mover a: Convocatoria abierta' });
  await expect(toRecruiting).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mover a: Publicado' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mover a: Archivado' })).toBeEnabled();

  // The database refuses it as well, naming the first missing item.
  await toRecruiting.evaluate((el) => el.removeAttribute('disabled'));
  await toRecruiting.click();
  await expect(page.getByText('Al reto le falta: resumen (necesario para publicarlo o mantenerlo publicado).')).toBeVisible();
  // Still a draft, so the checklist is still there (it shows while the challenge cannot be opened).
  await page.reload();
  await expect(checklist).toBeVisible();
  await expect(toRecruiting).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a company organization requires its website (https); a university does not', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  await enterDemo(page, 'company');
  await page.goto('/organization');
  let website = page.getByLabel('Sitio web (https)');
  let form = page.locator('form').filter({ has: website });
  await expect(website).toHaveAttribute('required', '');
  await expect(form.locator('label').filter({ hasText: 'Sitio web (https)' })).toContainText('*');
  await expect(website).toHaveValue('https://nova-manufacturing.example');

  await website.fill('');
  await form.getByRole('button', { name: 'Guardar' }).click();
  expect(await isInvalid(website)).toBe(true);
  await expect(form.getByText('Cambios guardados.')).toHaveCount(0);
  // Without the browser check, sp_update_organization refuses an empty website for a company.
  await dropRequired(website);
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form.getByText('Completa el campo obligatorio: sitio web.')).toBeVisible();
  await page.reload();
  await expect(website).toHaveValue('https://nova-manufacturing.example');

  await switchTo(page, 'university');
  await page.goto('/organization');
  website = page.getByLabel('Sitio web (https)');
  form = page.locator('form').filter({ has: website });
  await expect(website).not.toHaveAttribute('required');
  await expect(website).toHaveValue('');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form.getByText('Cambios guardados.')).toBeVisible();
  expect(errors).toEqual([]);
});
