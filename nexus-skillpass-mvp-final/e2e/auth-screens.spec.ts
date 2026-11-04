import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

test.describe('sign-up confirmation screens', () => {
  test('the check-email page explains the next steps even without a remembered address', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/signup/check-email');
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
    await expect(page.getByText('al correo con el que te registraste')).toBeVisible();
    await expect(page.locator('main').getByRole('listitem')).toHaveCount(3);
    // Without the sign-up cookie there is no address to resend to, so the page says how to get a new link.
    await expect(page.getByRole('button', { name: /Reenviar/ })).toHaveCount(0);
    await expect(page.getByText('inicia sesión con tu correo y contraseña: te ofreceremos uno nuevo')).toBeVisible();
    await page.goto('/signup/check-email?pending=1');
    await expect(page.getByText('Tu cuenta todavía no está confirmada')).toBeVisible();
    await page.getByRole('link', { name: 'Ya confirmé, iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });

  test('an invalid or used e-mail link lands on login with an explanation', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/auth/callback?token_hash=not-a-real-token&type=email&next=/onboarding');
    await expect(page).toHaveURL(/\/login\?notice=link_invalid$/);
    await expect(page.getByText('Ese enlace ya no es válido')).toBeVisible();
    await page.goto('/auth/callback?code=not-a-real-code&next=https://evil.example');
    await expect(page).toHaveURL(/\/login\?notice=link_invalid$/);
    await page.goto('/login');
    await expect(page.getByText('Ese enlace ya no es válido')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
