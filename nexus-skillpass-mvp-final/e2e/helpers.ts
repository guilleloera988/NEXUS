import { expect, type Page } from '@playwright/test';

export const PERSONA_BUTTON = {
  student: 'Entrar como María',
  company: 'Entrar como Laura',
  supervisor: 'Entrar como Carlos',
  university: 'Entrar como Dra.',
  admin: 'Entrar como Equipo',
} as const;
export const ROLE_LABEL = { student: 'Estudiante', company: 'Empresa', supervisor: 'Supervisor', university: 'Universidad', admin: 'Admin AINDEV' } as const;
export type Persona = keyof typeof PERSONA_BUTTON;

/** Starts a fresh, isolated DEMO scenario as the given persona. */
export async function enterDemo(page: Page, persona: Persona) {
  await page.goto('/demo');
  await page.getByRole('button', { name: PERSONA_BUTTON[persona] }).click();
  await page.waitForURL('**/dashboard', { timeout: 120_000 });
}

/** Switches persona inside the same scenario using the DEMO bar. */
export async function switchTo(page: Page, persona: Persona) {
  const bar = page.getByText('Cambiar de persona:').locator('..');
  await bar.getByRole('button', { name: ROLE_LABEL[persona], exact: true }).click();
  await expect(bar.getByRole('button', { name: ROLE_LABEL[persona], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForURL('**/dashboard');
}

/** Collects console errors and uncaught exceptions; tests assert the list stays empty. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(text)) return;
    errors.push(`${page.url()} → ${text.slice(0, 400)}`);
  });
  page.on('pageerror', (error) => errors.push(`${page.url()} → uncaught ${error.message}`));
  return errors;
}

export const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Minimal valid PDF so the server's content sniffing accepts it. */
export const SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r\n/).filter(Boolean);
  const cells = (line: string) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"').replace(/^'/, ''));
  const [header, ...rows] = lines.map(cells);
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
