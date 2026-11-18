import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { enterDemo, watchConsole } from './helpers';

test('a student downloads a credential as a signed Open Badge 3.0 that anyone can check', async ({ page, request }) => {
  test.skip(!!process.env.E2E_SUPABASE, 'the signing key is set only for the embedded DEMO run');
  const errors = watchConsole(page);
  await enterDemo(page, 'student');
  await page.goto('/my-skillpass');

  const link = page.getByRole('link', { name: 'Open Badge 3.0' }).first();
  await expect(link).toBeVisible();
  const [file] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(file.suggestedFilename()).toMatch(/^SkillPass-SKP-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}\.json$/);
  const badge = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(badge['@context']).toEqual(['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json']);
  expect(badge.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential']);
  expect(badge.name).toMatch(/^DEMO · SkillPass: /);
  expect(badge.proof).toMatchObject({ type: 'DataIntegrityProof', cryptosuite: 'eddsa-rdfc-2022', proofPurpose: 'assertionMethod' });
  expect(badge.credentialSubject.identifier[0]).toMatchObject({ type: 'IdentityObject', identityType: 'emailAddress', hashed: true });

  // What a verifier fetches: the issuer's DID document and the credential's status list, both public.
  const did = await (await request.get('/.well-known/did.json')).json();
  expect(badge.issuer.id).toBe(did.id);
  expect(did.assertionMethod).toContain(badge.proof.verificationMethod);
  const statusUrl = new URL(badge.credentialStatus.statusListCredential);
  const list = await request.get(`${statusUrl.pathname}${statusUrl.search}`);
  expect(list.status()).toBe(200);
  expect(await list.json()).toMatchObject({ issuer: did.id, type: ['VerifiableCredential', 'BitstringStatusListCredential'], proof: { cryptosuite: 'eddsa-rdfc-2022' } });

  // LinkedIn gets the public verification page and the credential code.
  const linkedIn = new URL(await page.getByRole('link', { name: 'Agregar a LinkedIn' }).first().getAttribute('href') ?? '');
  expect(linkedIn.hostname).toBe('www.linkedin.com');
  expect(linkedIn.searchParams.get('certUrl')).toBe(badge.evidence[0].id);
  expect(linkedIn.searchParams.get('certId')).toMatch(/^SKP-/);

  // Every verified competency points to its description in the public framework.
  const target = new URL(badge.credentialSubject.achievement.alignment[0].targetUrl);
  await page.goto(target.pathname);
  await expect(page.getByRole('heading', { level: 1, name: 'Marco de competencias SkillPass' })).toBeVisible();
  await expect(page.locator(`[id="${target.hash.slice(1)}"]`)).toBeVisible();
  await expect(page.getByText(did.id)).toBeVisible();
  expect(errors).toEqual([]);
});
