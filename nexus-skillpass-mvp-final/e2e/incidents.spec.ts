import { expect, test } from '@playwright/test';
import { enterDemo, switchTo, watchConsole } from './helpers';

test('a student reports a problem and AINDEV resolves it in Talent OS', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  const description = `La fecha de mi credencial aparece incorrecta (E2E ${Date.now().toString(36)}).`;
  await enterDemo(page, 'student');
  await page.goto('/my-skillpass?tab=privacy');
  const card = page.locator('section').filter({ hasText: 'Reportar un problema' });
  await card.getByLabel('Categoría').selectOption('incorrect_data');
  await card.getByLabel('Descripción').fill(description);
  await card.getByRole('button', { name: 'Enviar' }).click();
  await expect(card.getByText('Reporte enviado. AINDEV lo revisará.')).toBeVisible();

  await switchTo(page, 'admin');
  await page.goto('/admin/incidents');
  const item = page.getByRole('listitem').filter({ hasText: description });
  await expect(item).toBeVisible();
  await expect(item.getByText('María Torres')).toBeVisible();
  await item.getByLabel('Estado').selectOption('resolved');
  await item.getByLabel('Resolución').fill('Fecha corregida en el registro.');
  await item.getByRole('button', { name: 'Actualizar' }).click();
  await expect(item.getByText('Cambios guardados.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: description }).getByText('Resuelto').first()).toBeVisible();
  expect(errors).toEqual([]);
});
