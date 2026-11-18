// SkillPass antivirus scanner: a small HTTP front for clamd (ClamAV). No dependencies.
//
//   POST /scan   body = the file (at most MAX_SCAN_BYTES), header Authorization: Bearer <SCANNER_TOKEN>
//                -> 200 {"status":"clean","engine":"ClamAV 1.x/…"} | {"status":"infected","signature":"…","engine":"…"}
//                -> 401 bad token · 413 too large · 503 clamd unavailable or scan error
//   GET /health  -> 200 {"ok":true,"engine":"…"} once clamd answers, 503 before (no token: for the platform's health check)
//
// Files are scanned in memory and never written to disk or logged; each scan logs only its verdict, size and time.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { connect } from 'node:net';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = (process.env.SCANNER_TOKEN || '').trim();
const SOCKET = process.env.CLAMD_SOCKET || '';
const CLAMD_HOST = process.env.CLAMD_HOST || '127.0.0.1';
const CLAMD_PORT = Number(process.env.CLAMD_PORT || 3310);
const MAX_BYTES = Number(process.env.MAX_SCAN_BYTES || 10 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.CLAMD_TIMEOUT_MS || 30_000);

if (TOKEN.length < 32) {
  console.error('SCANNER_TOKEN must be set to at least 32 characters');
  process.exit(1);
}
const TOKEN_DIGEST = createHash('sha256').update(TOKEN).digest();

/** Sends one z-command to clamd (optionally streaming a payload with INSTREAM) and returns its reply. */
export function clamd(command, payload) {
  return new Promise((resolve, reject) => {
    const socket = SOCKET ? connect({ path: SOCKET }) : connect({ host: CLAMD_HOST, port: CLAMD_PORT });
    const chunks = [];
    const fail = (error) => { socket.destroy(); reject(error); };
    socket.setTimeout(TIMEOUT_MS, () => fail(new Error('clamd timeout')));
    socket.on('error', fail);
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').replace(/\0+$/, '').trim()));
    socket.on('connect', () => {
      socket.write(`z${command}\0`);
      if (payload) {
        for (let offset = 0; offset < payload.length; offset += 64 * 1024) {
          const part = payload.subarray(offset, offset + 64 * 1024);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(part.length);
          socket.write(size);
          socket.write(part);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });
}

let engine = { value: '', at: 0 };
async function engineVersion() {
  if (!engine.value || Date.now() - engine.at > 60_000) engine = { value: (await clamd('VERSION')).slice(0, 120), at: Date.now() };
  return engine.value;
}

/** Interprets clamd's reply to INSTREAM. */
export function verdict(reply) {
  if (/^stream: OK$/.test(reply)) return { status: 'clean' };
  const found = /^stream: (.+) FOUND$/.exec(reply);
  if (found) return { status: 'infected', signature: found[1].slice(0, 200) };
  throw new Error(`clamd: ${reply.slice(0, 200) || 'empty reply'}`);
}

function authorized(header) {
  const match = /^Bearer (.+)$/.exec(header || '');
  return !!match && timingSafeEqual(createHash('sha256').update(match[1]).digest(), TOKEN_DIGEST);
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    if (req.method === 'GET' && req.url === '/health') {
      const pong = await clamd('PING');
      if (pong !== 'PONG') throw new Error('clamd did not answer PING');
      return send(res, 200, { ok: true, engine: await engineVersion() });
    }
    if (req.method !== 'POST' || req.url !== '/scan') return send(res, 404, { error: 'not_found' });
    if (!authorized(req.headers.authorization)) return send(res, 401, { error: 'unauthorized' });
    const body = await readBody(req);
    if (!body) return send(res, 413, { error: 'too_large' });
    if (body.length === 0) return send(res, 400, { error: 'empty' });
    const result = { ...verdict(await clamd('INSTREAM', body)), engine: await engineVersion() };
    console.log(JSON.stringify({ scan: result.status, signature: result.signature, bytes: body.length, ms: Date.now() - started }));
    return send(res, 200, result);
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error), path: req.url, ms: Date.now() - started }));
    return send(res, 503, { error: 'unavailable' });
  }
});

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  server.listen(PORT, () => console.log(`scanner listening on ${PORT}`));
}
