#!/usr/bin/env node
/* WILD vault: encrypt and decrypt members-only content files.

   File format (".wv"): 4 bytes "WV01", 12-byte random IV, then AES-256-GCM
   ciphertext of the gzipped file (16-byte tag at the end, as WebCrypto
   expects). Additional data = "<app>|<epoch>", so a file cannot be swapped
   between apps or quarters. The browser side is wild-vault.js.

   Keys are never stored in the repo. Each app and calendar quarter has its own
   key, derived in n8n ("WILD - content key", run its "Admin: get keys" path).
   Pass keys in the environment, never on the command line:
     WILD_VAULT_KEY      key for --epoch (64 hex chars)
     WILD_VAULT_OLD_KEY  previous key, only for "rotate"

   Usage:
     node tools/wild-vault.mjs encrypt <src> <dest> --app codex --epoch 2026Q4
     node tools/wild-vault.mjs decrypt <src> <dest> --app codex --epoch 2026Q4
     node tools/wild-vault.mjs rotate  <dir> --app codex --from 2026Q3 --to 2026Q4
   <src>/<dest> may be files or folders. Encrypting a folder writes "<name>.wv"
   for every file; decrypting strips ".wv". */
import { webcrypto as crypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const MAGIC = Buffer.from('WV01');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
}
function hexKey(envName) {
  const h = (process.env[envName] || '').trim();
  if (!/^[0-9a-f]{64}$/i.test(h)) throw new Error(envName + ' must be 64 hex characters');
  return crypto.subtle.importKey('raw', Buffer.from(h, 'hex'), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const aad = (app, epoch) => new TextEncoder().encode(app + '|' + epoch);

export async function encryptBuf(key, app, epoch, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(app, epoch) }, key, gzipSync(plain, { level: 9 }));
  return Buffer.concat([MAGIC, Buffer.from(iv), Buffer.from(ct)]);
}
export async function decryptBuf(key, app, epoch, buf) {
  if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error('not a WILD vault file');
  const iv = buf.subarray(4, 16);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(app, epoch) }, key, buf.subarray(16));
  return gunzipSync(Buffer.from(pt));
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

async function each(src, dest, fn, rename) {
  const st = fs.statSync(src);
  const files = st.isDirectory() ? walk(src) : [src];
  let n = 0;
  for (const f of files) {
    const out = st.isDirectory() ? path.join(dest, rename(path.relative(src, f))) : dest;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await fn(fs.readFileSync(f)));
    n++;
  }
  return n;
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  const app = arg('app');
  if (!app) throw new Error('--app is required');
  if (cmd === 'encrypt' || cmd === 'decrypt') {
    const epoch = arg('epoch');
    if (!/^\d{4}Q[1-4]$/.test(epoch || '')) throw new Error('--epoch like 2026Q4 is required');
    const key = await hexKey('WILD_VAULT_KEY');
    const n = cmd === 'encrypt'
      ? await each(a, b, p => encryptBuf(key, app, epoch, p), r => r + '.wv')
      : await each(a, b, c => decryptBuf(key, app, epoch, c), r => r.replace(/\.wv$/, ''));
    console.log(`${cmd}ed ${n} file(s)`);
  } else if (cmd === 'rotate') {
    const from = arg('from'), to = arg('to');
    const oldKey = await hexKey('WILD_VAULT_OLD_KEY'), newKey = await hexKey('WILD_VAULT_KEY');
    const files = walk(a).filter(f => f.endsWith('.wv'));
    for (const f of files) {
      const plain = await decryptBuf(oldKey, app, from, fs.readFileSync(f));
      fs.writeFileSync(f, await encryptBuf(newKey, app, to, plain));
    }
    console.log(`rotated ${files.length} file(s) from ${from} to ${to}`);
  } else {
    console.log('usage: encrypt|decrypt <src> <dest> --app A --epoch E | rotate <dir> --app A --from E1 --to E2');
    process.exit(2);
  }
}
if (import.meta.url === 'file://' + process.argv[1] || process.argv[1]?.endsWith('wild-vault.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
