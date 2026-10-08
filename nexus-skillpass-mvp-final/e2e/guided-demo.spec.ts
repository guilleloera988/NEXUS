import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

test('guided demo walks the 9 steps across personas', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchConsole(page);
  await page.goto('/demo');
  await page.getByRole('button', { name: /demo guiada/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
  const guide = page.getByRole('region', { name: 'Demo guiada' });
  await expect(guide).toBeVisible();
  const expected = [
    /\/dashboard/, /\/challenges\//, /\/workspace\/[^?]+$/, /tab=evidence/, /tab=validation/, /\/validations/, /\/my-skillpass/, /\/verify\/SKP-/, /\/dashboard/,
  ];
  for (let step = 1; step <= 9; step += 1) {
    await expect(guide.getByText(`Paso ${step} de 9`)).toBeVisible();
    await expect(page).toHaveURL(expected[step - 1]);
    if (step < 9) await guide.getByRole('button', { name: 'Siguiente paso' }).click();
  }
  await guide.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByRole('button', { name: /Mostrar guía/ })).toBeVisible();
  expect(errors).toEqual([]);
});
