import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHALLENGE, USERS, createDatabase, sql, type TestDb } from './helpers/pg';

// Minimal stand-in for the Supabase Storage schema (same table names, the foldername helper
// and RLS enabled on objects) so the storage migration's policies are exercised for real.
const STORAGE_STUB = `
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid, unique (bucket_id, name));
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
`;

const MARIA_C1_PDF = `${USERS.maria}/${CHALLENGE(1)}/8f3a2c-mapa-proceso-comercial.pdf`;
const MARIA_C2_PNG = `${USERS.maria}/${CHALLENGE(2)}/b71d09-dashboard-inventario.png`;
const DIEGO_C1_PDF = `${USERS.diego}/${CHALLENGE(1)}/c52e71-bitacora-entrevistas.pdf`;

let db: TestDb;
// Supabase Storage sets storage.operation per request: listing is 'storage.object.list',
// createSignedUrl (the only public download path) is 'storage.object.sign'.
const visible = async (actor: string | null, operation = 'storage.object.list') =>
  (await sql<{ name: string }>(db, actor, "select name from storage.objects where bucket_id = 'evidence' order by name", [],
    { 'storage.operation': operation })).map((r) => r.name);

beforeAll(async () => {
  db = await createDatabase({ extraSql: STORAGE_STUB });
  for (const name of [MARIA_C1_PDF, MARIA_C2_PNG, DIEGO_C1_PDF]) {
    await db.query("insert into storage.objects (bucket_id, name) values ('evidence', $1)", [name]);
  }
});
afterAll(async () => { await db?.close(); });

describe('evidence storage bucket and policies', () => {
  it('creates a private bucket with a size limit and MIME allow-list', async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: string | number; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'evidence'");
    expect(rows).toHaveLength(1);
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(10485760);
    expect(rows[0].allowed_mime_types).toContain('application/pdf');
    expect(rows[0].allowed_mime_types).not.toContain('text/html');
  });

  it('anonymous visitors can sign only files of published evidence behind an active, verifiable credential', async () => {
    expect(await visible(null, 'storage.object.sign')).toEqual([MARIA_C2_PNG]);
  });

  it('public evidence files cannot be listed (no enumeration without the credential)', async () => {
    expect(await visible(null)).toEqual([]);
    expect(await visible(null, '')).toEqual([]);
    expect(await visible(USERS.jorge)).toEqual([]);
  });

  it('owners see their files; unrelated students only reach public files by exact path', async () => {
    const maria = await visible(USERS.maria);
    expect(maria).toEqual(expect.arrayContaining([MARIA_C1_PDF, MARIA_C2_PNG]));
    expect(await visible(USERS.jorge, 'storage.object.sign')).toEqual([MARIA_C2_PNG]);
  });

  it('the challenge supervisor can open submitted evidence files', async () => {
    expect(await visible(USERS.carlos)).toEqual(expect.arrayContaining([DIEGO_C1_PDF, MARIA_C1_PDF]));
  });

  it('uploads are limited to the own folder of an active assignment', async () => {
    await sql(db, USERS.maria, "insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${USERS.maria}/${CHALLENGE(1)}/aa11-nuevo.pdf`]);
    await expect(sql(db, USERS.maria, "insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${USERS.diego}/${CHALLENGE(1)}/bb22-ajeno.pdf`]))
      .rejects.toThrow(/row-level security/);
    await expect(sql(db, USERS.maria, "insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${USERS.maria}/${CHALLENGE(2)}/cc33-cerrado.pdf`]))
      .rejects.toThrow(/row-level security/);
    await expect(sql(db, null, "insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${USERS.maria}/${CHALLENGE(1)}/dd44-anon.pdf`]))
      .rejects.toThrow(/row-level security|permission denied/);
  });

  it('files of reviewed evidence cannot be deleted by the student', async () => {
    const approved = await sql<{ name: string }>(db, USERS.maria, 'delete from storage.objects where name = $1 returning name', [MARIA_C1_PDF]);
    expect(approved).toEqual([]);
    const orphan = await sql<{ name: string }>(db, USERS.maria, 'delete from storage.objects where name = $1 returning name', [`${USERS.maria}/${CHALLENGE(1)}/aa11-nuevo.pdf`]);
    expect(orphan).toHaveLength(1);
  });
});
