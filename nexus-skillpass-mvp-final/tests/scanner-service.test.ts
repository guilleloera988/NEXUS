import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server, type Socket } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/*
 * scanner/server.mjs (the HTTP front for clamd) against a fake clamd that speaks the same protocol: z-commands,
 * INSTREAM chunks with a 4-byte length and a zero-length terminator. The real clamd was exercised by hand with the
 * EICAR test file (docs/SECURITY.md); this suite runs everywhere, CI included.
 */
const TOKEN = 'scanner-test-token-0123456789abcdef0123456789';
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
let clamd: Server; let clamdUp = true; let scanner: ChildProcess; let base = '';
const streams: number[] = [];

function fakeClamd(socket: Socket) {
  let buffer = Buffer.alloc(0); let command = ''; const data: Buffer[] = [];
  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!command) {
      const end = buffer.indexOf(0);
      if (end < 0) return;
      command = buffer.subarray(0, end).toString();
      buffer = buffer.subarray(end + 1);
      if (command === 'zPING') return socket.end('PONG\0');
      if (command === 'zVERSION') return socket.end('ClamAV 1.4.2/27453/Tue Nov  3 09:00:00 2026\0');
      if (command !== 'zINSTREAM') return socket.end('UNKNOWN COMMAND\0');
    }
    while (buffer.length >= 4) {
      const size = buffer.readUInt32BE(0);
      if (size === 0) {
        const body = Buffer.concat(data);
        streams.push(body.length);
        return socket.end(body.includes(Buffer.from('EICAR-STANDARD')) ? 'stream: Win.Test.EICAR_HDB-1 FOUND\0' : 'stream: OK\0');
      }
      if (buffer.length < 4 + size) return;
      data.push(buffer.subarray(4, 4 + size));
      buffer = buffer.subarray(4 + size);
    }
  });
}

beforeAll(async () => {
  clamd = createServer((socket) => (clamdUp ? fakeClamd(socket) : socket.destroy()));
  await new Promise<void>((r) => clamd.listen(0, '127.0.0.1', () => r()));
  const clamdPort = (clamd.address() as { port: number }).port;
  const port = 20000 + Math.floor(Math.random() * 20000);
  scanner = spawn(process.execPath, [path.resolve('scanner/server.mjs')], {
    env: { ...process.env, SCANNER_TOKEN: TOKEN, PORT: String(port), CLAMD_HOST: '127.0.0.1', CLAMD_PORT: String(clamdPort), MAX_SCAN_BYTES: String(256 * 1024) },
    stdio: 'pipe',
  });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
});
afterAll(() => { scanner?.kill(); clamd?.close(); });

const scan = (body: BodyInit, token: string | null = TOKEN) =>
  fetch(`${base}/scan`, { method: 'POST', body, headers: token === null ? {} : { authorization: `Bearer ${token}` } });

describe('antivirus scanner service', () => {
  it('reports clamd health and engine without a token', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, engine: 'ClamAV 1.4.2/27453/Tue Nov  3 09:00:00 2026' });
  });

  it('scans only for callers with the token', async () => {
    expect((await scan('hola', null)).status).toBe(401);
    expect((await scan('hola', 'wrong-token')).status).toBe(401);
    expect((await scan('hola', `${TOKEN}x`)).status).toBe(401);
  });

  it('streams the file to clamd in chunks and returns its verdict', async () => {
    const clean = Buffer.alloc(200 * 1024, 7);
    const res = await scan(clean);
    expect(await res.json()).toEqual({ status: 'clean', engine: expect.stringMatching(/^ClamAV/) });
    expect(streams.at(-1)).toBe(clean.length);
    expect(await (await scan(EICAR)).json()).toEqual({ status: 'infected', signature: 'Win.Test.EICAR_HDB-1', engine: expect.any(String) });
  });

  it('refuses empty and oversized bodies before reaching clamd', async () => {
    const before = streams.length;
    expect((await scan('')).status).toBe(400);
    expect((await scan(Buffer.alloc(256 * 1024 + 1))).status).toBe(413);
    expect(streams.length).toBe(before);
  });

  it('answers 503 when clamd is down, and recovers with it', async () => {
    clamdUp = false;
    expect((await fetch(`${base}/health`)).status).toBe(503);
    expect((await scan('hola')).status).toBe(503);
    clamdUp = true;
    expect((await scan('hola')).status).toBe(200);
  });

  it('serves nothing else', async () => {
    expect((await fetch(`${base}/`)).status).toBe(404);
    expect((await fetch(`${base}/scan`)).status).toBe(404);
  });
});
