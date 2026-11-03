import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';

/*
 * Second factor (migration 20261103000002). The embedded DEMO keeps it off, so this checks the routing only:
 * signed-out visitors are sent to sign in first, and DEMO sessions are never asked for a code. The TOTP steps
 * themselves are covered with a fake Supabase client in tests/unit/mfa.test.ts.
 */
test.skip(!!process.env.E2E_SUPABASE, 'routing check for the embedded DEMO');

test('the second-factor page needs a session and is skipped in the DEMO', async ({ page }) => {
  await page.goto('/mfa');
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa/);
  await enterDemo(page, 'admin');
  await page.goto('/mfa?next=/admin');
  await expect(page).toHaveURL(/\/admin$/);
});
