import type { GhostChallengeV2 } from '../../domain/types.ts';
import { GHOST_LIMITS } from './config.ts';
import { parseGhostChallengeV2 } from './schemas.ts';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64u.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function compressDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const writePromise = (async () => {
    await writer.write(copy);
    await writer.close();
  })();
  const readPromise = new Response(cs.readable).arrayBuffer();
  const [, buf] = await Promise.all([writePromise, readPromise]);
  return new Uint8Array(buf);
}

async function decompressDeflateRawBounded(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  // Attacher catch immédiatement pour éviter toute unhandledRejection sur flux corrompu
  const writePromise = writer
    .write(copy)
    .then(() => writer.close())
    .catch(() => {});

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('Code Ghost trop volumineux après décompression.');
      }
      chunks.push(value);
    }
  } finally {
    await writePromise;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const ch of chunks) {
    merged.set(ch, offset);
    offset += ch.byteLength;
  }
  return merged;
}

export function needsGhostFile(token: string): boolean {
  return token.length > GHOST_LIMITS.maxUrlChars;
}

/** Encode un défi amical L0 au format officiel KT2.<deflate-raw base64url> (Bible p.8). */
export async function encodeGhostV2(payload: GhostChallengeV2): Promise<string> {
  const validated = parseGhostChallengeV2(payload);
  const jsonBytes = new TextEncoder().encode(JSON.stringify(validated));
  if (jsonBytes.byteLength > GHOST_LIMITS.maxDecompressedBytes) {
    throw new Error('Charge Ghost trop volumineuse.');
  }
  const compressed = await compressDeflateRaw(jsonBytes);
  const token = `${GHOST_LIMITS.prefix}${bytesToBase64Url(compressed)}`;
  if (token.length > GHOST_LIMITS.maxTokenChars) {
    throw new Error('Jeton Ghost dépasse le plafond autorisé.');
  }
  return token;
}

/** Décode et valide un code ou fichier .ktghost (taille bornée + Zod .strict()). */
export async function decodeGhostV2(rawInput: string): Promise<GhostChallengeV2> {
  const cleaned = rawInput.trim().replace(/^.*challenge=/, '');
  if (cleaned.length > GHOST_LIMITS.maxTokenChars) {
    throw new Error(`Code Ghost trop grand (> ${GHOST_LIMITS.maxTokenChars} caractères).`);
  }
  if (!cleaned.startsWith(GHOST_LIMITS.prefix)) {
    throw new Error('Préfixe attendu : KT2.');
  }
  const body = cleaned.slice(GHOST_LIMITS.prefix.length);
  if (!body || !/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new Error('Encodage Base64URL Ghost invalide.');
  }
  const compressed = base64UrlToBytes(body);
  const decompressed = await decompressDeflateRawBounded(
    compressed,
    GHOST_LIMITS.maxDecompressedBytes
  );
  const text = new TextDecoder().decode(decompressed);
  const parsed: unknown = JSON.parse(text);
  return parseGhostChallengeV2(parsed);
}
