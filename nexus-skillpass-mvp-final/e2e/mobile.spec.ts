import { expect, test, type Page } from '@playwright/test';
import { enterDemo, watchConsole } from './helpers';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(1);
}

test('public pages are usable on a phone', async ({ page }) => {
  const errors = watchConsole(page);
  for (const path of ['/', '/demo', '/login', '/signup', '/signup/check-email?pending=1', '/verify']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
  expect(errors).toEqual([]);
});

test('core screens fit a phone and the menu works', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  await enterDemo(page, 'student');
  for (const path of ['/dashboard', '/challenges', '/workspace/40000000-0000-4000-8000-000000000001', '/my-skillpass', '/profile']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const nav = page.locator('#mobile-nav');
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Mi SkillPass' }).click();
  await expect(page).toHaveURL(/\/my-skillpass/);
  await expect(nav).toBeHidden();
  expect(errors).toEqual([]);
});
