import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import { SAMPLE_PDF, enterDemo, isoDate, parseCsv, switchTo, watchConsole } from './helpers';

/*
 * Acceptance test — critical flow (FLOW 01 → FLOW 10), executed through the real UI in one
 * isolated DEMO scenario. Persona switches keep the same database, exactly as an evaluator would.
 */
test('FLOW 01–10 · challenge → work → evidence → VATH → validation → SkillPass → public verification → QR → analytics', async ({ page, browser, baseURL }) => {
  test.setTimeout(600_000);
  const errors = watchConsole(page);
  const stamp = Date.now().toString(36).toUpperCase();
  const title = `E2E ${stamp} · Bitácora digital de mantenimiento`;
  const evidenceTitle = `Diagnóstico de mantenimiento ${stamp}`;
  // Small, spread-out entries keep the test repeatable on shared backends (16 h/day limit per student).
  const hours = 2;
  const activityDay = -(1 + (Date.now() % 6));
  let challengeId = '';
  let code = '';
  let vathBefore = 0;
  let publicLink = '';

  await test.step('baseline · university analytics before the flow', async () => {
    await enterDemo(page, 'university');
    const csv = await page.request.get('/api/university/students.csv');
    expect(csv.status()).toBe(200);
    const maria = parseCsv(await csv.text()).find((r) => r.student === 'María Torres');
    expect(maria).toBeDefined();
    vathBefore = Number(maria!.verified_vath);
  });

  await test.step('FLOW 01 · company creates and publishes a challenge that persists', async () => {
    await switchTo(page, 'company');
    await page.goto('/challenges/new');
    await page.getByLabel('Nombre del reto').fill(title);
    await page.getByLabel('Resumen (una línea)').fill('Digitalizar la bitácora de mantenimiento preventivo.');
    await page.getByLabel('Problema a resolver').fill('Las órdenes de mantenimiento se registran en papel y se pierden entre turnos.');
    await page.getByLabel(/^Objetivo/).fill('Entregar un prototipo de bitácora digital validado con el equipo de planta.');
    await page.getByLabel('Fecha de inicio').fill(isoDate(-7));
    await page.getByLabel('Fecha de fin').fill(isoDate(60));
    await page.getByLabel('Supervisor del reto').selectOption({ label: 'Carlos Méndez · Supervisor' });
    await page.getByRole('button', { name: 'Agregar competencia' }).click();
    await page.locator('#comp-0').selectOption({ label: 'Automatización de procesos · Técnica' });
    await page.getByRole('button', { name: 'Agregar entregable' }).click();
    await page.locator('#del-t-0').fill('Prototipo de bitácora digital');
    await page.getByRole('button', { name: 'Publicar y abrir convocatoria' }).click();
    await page.waitForURL(/\/challenges\/[0-9a-f-]{36}$/);
    challengeId = page.url().split('/').pop()!;
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('Convocatoria abierta').first()).toBeVisible();
    await page.goto('/challenges?scope=mine');
    await expect(page.getByText(title)).toBeVisible();
  });

  await test.step('FLOW 02 · student applies, company assigns, student reaches the workspace', async () => {
    await switchTo(page, 'student');
    await page.goto(`/challenges/${challengeId}`);
    await expect(page.getByText('Compatibilidad').first()).toBeVisible();
    await page.getByLabel('¿Por qué quieres participar?').fill('Ya automaticé procesos comerciales en Nova y quiero aplicar lo aprendido en mantenimiento.');
    await page.getByRole('button', { name: 'Enviar aplicación' }).click();
    await expect(page.getByText('Tu aplicación')).toBeVisible();

    await switchTo(page, 'company');
    await page.goto(`/challenges/${challengeId}?tab=candidates`);
    await expect(page.getByText('María Torres').first()).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar y asignar' }).click();
    await expect(page.getByText('Aceptada').first()).toBeVisible();

    await switchTo(page, 'student');
    const res = await page.goto(`/workspace/${challengeId}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  });

  await test.step('FLOW 03 · student uploads evidence linked to the challenge', async () => {
    await page.goto(`/workspace/${challengeId}?tab=evidence`);
    await page.getByRole('button', { name: 'Agregar evidencia' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Subir archivo' }).click();
    await dialog.getByLabel('Título').fill(evidenceTitle);
    await dialog.getByLabel('Descripción').fill('Levantamiento de órdenes y tiempos actuales (archivo de prueba E2E).');
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'diagnóstico mantenimiento.pdf', mimeType: 'application/pdf', buffer: SAMPLE_PDF });
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(evidenceTitle).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(evidenceTitle).first()).toBeVisible();
  });

  await test.step('FLOW 04 · student registers VATH and submits it; hours stay pending validation', async () => {
    await page.goto(`/workspace/${challengeId}?tab=vath`);
    await page.getByRole('button', { name: 'Registrar VATH' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Fecha').fill(isoDate(activityDay));
    await dialog.getByLabel('Actividad').fill('Levantamiento en planta');
    await dialog.getByLabel('Horas aplicadas').fill(String(hours));
    await dialog.getByLabel('Descripción del trabajo realizado').fill('Entrevistas con técnicos y revisión de órdenes de mantenimiento del último trimestre.');
    await dialog.getByLabel(evidenceTitle, { exact: false }).check();
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Levantamiento en planta').first()).toBeVisible();

    await page.goto(`/workspace/${challengeId}?tab=validation`);
    await page.getByRole('button', { name: 'Enviar a validación' }).click();
    await page.waitForURL(/submitted=1/);
    await expect(page.getByText('Enviado a validación.')).toBeVisible();
    await page.goto(`/workspace/${challengeId}?tab=vath`);
    await expect(page.getByText('En validación').first()).toBeVisible();
  });

  let evidenceHref = '';
  await test.step('FLOW 05 · supervisor reviews hours and evidence', async () => {
    await switchTo(page, 'supervisor');
    await page.goto('/validations');
    const row = page.getByRole('listitem').filter({ hasText: title }).filter({ hasText: 'María Torres' });
    await row.getByRole('link', { name: 'Revisar' }).click();
    await page.waitForURL(/\/validations\/[0-9a-f-]{36}/);
    await expect(page.getByText(evidenceTitle).first()).toBeVisible();
    await expect(page.getByText('Levantamiento en planta').first()).toBeVisible();
    evidenceHref = (await page.locator('a[href^="/api/evidence/"]').first().getAttribute('href')) ?? '';
    expect(evidenceHref).toMatch(/^\/api\/evidence\/[0-9a-f-]{36}\/file$/);
    const file = await page.request.get(evidenceHref);
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toContain('application/pdf');
    expect((await file.body()).subarray(0, 4).toString()).toBe('%PDF');
  });

  await test.step('FLOW 06 · supervisor validates hours, evidence and competencies; credential issued', async () => {
    await page.getByRole('radiogroup', { name: 'Automatización de procesos' }).getByRole('radio', { name: '4' }).click();
    await page.getByLabel('Retroalimentación para el estudiante').fill('Buen levantamiento y documentación clara.');
    await page.getByLabel('Confirmar la experiencia y emitir la credencial SkillPass').check();
    await page.getByRole('button', { name: 'Completar validación' }).click();
    await page.waitForURL(/done=1/);
    const alert = page.getByText(/SKP-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/).first();
    await expect(alert).toBeVisible();
    code = /SKP-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/.exec((await alert.textContent()) ?? '')![0];
  });

  await test.step('FLOW 07 · SkillPass shows the project, verified VATH and competencies', async () => {
    await switchTo(page, 'student');
    await page.goto('/my-skillpass');
    const card = page.locator('article, section').filter({ hasText: code }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText(title)).toBeVisible();
    await expect(card.getByText('Automatización de procesos · Nivel 4')).toBeVisible();
    // Public link as the student shares it. In the local DEMO it carries the scenario id (?demo=…).
    publicLink = (await card.getByRole('link', { name: 'Ver en línea' }).getAttribute('href')) ?? '';
    expect(publicLink.startsWith(`${baseURL}/verify/${code}`)).toBe(true);
    await page.goto(`/workspace/${challengeId}?tab=vath`);
    await expect(page.getByText('Verificada').first()).toBeVisible();
  });

  await test.step('FLOW 08 · the public URL verifies the credential without signing in', async () => {
    const anon = await browser.newContext({ locale: 'es-MX' });
    const pub = await anon.newPage();
    const pubErrors = watchConsole(pub);
    const res = await pub.goto(publicLink);
    expect(res?.status()).toBe(200);
    await expect(pub.getByText('Credencial válida').first()).toBeVisible();
    await expect(pub.getByText('María Torres').first()).toBeVisible();
    await expect(pub.getByText(title).first()).toBeVisible();
    await expect(pub.getByText(evidenceTitle)).toHaveCount(0);
    await pub.goto('/verify/SKP-2026-0000-0000');
    await expect(pub.getByText('Credencial no encontrada')).toBeVisible();
    const privateFile = await pub.request.get(evidenceHref);
    expect([401, 403, 404]).toContain(privateFile.status());
    expect(pubErrors).toEqual([]);
    await anon.close();
  });

  await test.step('FLOW 09 · the QR encodes and opens the verification URL', async () => {
    const anon = await browser.newContext({ locale: 'es-MX' });
    const pub = await anon.newPage();
    await pub.goto(publicLink);
    const qr = pub.locator('[data-qr-value]').first();
    await expect(qr).toHaveAttribute('data-qr-value', publicLink);
    const png = PNG.sync.read(await qr.screenshot({ scale: 'device' }));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(publicLink);
    await pub.goto(decoded!.data);
    await expect(pub.getByText('Credencial válida').first()).toBeVisible();
    await anon.close();
  });

  await test.step('FLOW 10 · university analytics reflect the newly verified hours', async () => {
    await switchTo(page, 'university');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const csv = await page.request.get('/api/university/students.csv');
    const maria = parseCsv(await csv.text()).find((r) => r.student === 'María Torres');
    expect(Number(maria!.verified_vath)).toBeCloseTo(vathBefore + hours, 2);
  });

  expect(errors).toEqual([]);
});
