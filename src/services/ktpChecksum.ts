/**
 * Calcule le checksum SHA-256 hexadécimal attendu par AWS ktp-backend (`POST /challenges/:id/submit`).
 * Compatible navigateurs modernes, Vite et Node 22 via Web Crypto API.
 */
export async function computeKtpChecksum(
  challengeId: string,
  playerId: string,
  evLossBb: number,
  reactionMs: number,
  seed: string
): Promise<string> {
  const raw = `${challengeId}:${playerId}:${evLossBb}:${reactionMs}:${seed}`;
  const bytes = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
