import crypto from 'node:crypto';

export interface ReceiptPayload {
  schemaVersion: 1;
  matchId: string;
  league: string;
  season: number;
  settledAt: string;
  rulesVersion: string;
  corpusVersion: string;
  outcomeA: 0 | 0.5 | 1;
  playerA: { id: string; pseudo: string; pd: number; ratingBefore: number; ratingAfter: number };
  playerB: { id: string; pseudo: string; pd: number; ratingBefore: number; ratingAfter: number };
}

export interface SignedReceipt {
  payload: ReceiptPayload;
  signature: string;
  publicKeyPem: string;
  alg: 'Ed25519';
}

export interface ReceiptSigner {
  publicKeyPem: string;
  signReceipt(payload: ReceiptPayload): SignedReceipt;
  verifyReceipt(signed: SignedReceipt): boolean;
}

export function hashEmail(email: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

export function deriveDailySecretSeed(masterSecret: string, dailyKey: string): string {
  return crypto
    .createHmac('sha256', masterSecret)
    .update(`daily-seed:${dailyKey}`, 'utf8')
    .digest('hex');
}

export function computeDailyCommitment(secretSeed: string, templateIds: readonly string[]): string {
  return crypto
    .createHash('sha256')
    .update(`${secretSeed}:${templateIds.join(',')}`, 'utf8')
    .digest('hex');
}

export function createReceiptSigner(opts?: {
  privateKeyPem?: string;
  publicKeyPem?: string;
}): ReceiptSigner {
  const keys =
    opts?.privateKeyPem && opts?.publicKeyPem
      ? {
          privateKey: crypto.createPrivateKey(opts.privateKeyPem),
          publicKey: crypto.createPublicKey(opts.publicKeyPem),
          publicKeyPem: opts.publicKeyPem,
        }
      : (() => {
          const generated = crypto.generateKeyPairSync('ed25519');
          return {
            privateKey: generated.privateKey,
            publicKey: generated.publicKey,
            publicKeyPem: generated.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
          };
        })();

  return {
    publicKeyPem: keys.publicKeyPem,
    signReceipt(payload: ReceiptPayload): SignedReceipt {
      const canonical = JSON.stringify(payload);
      const signature = crypto
        .sign(null, Buffer.from(canonical, 'utf8'), keys.privateKey)
        .toString('base64url');
      return {
        payload,
        signature,
        publicKeyPem: keys.publicKeyPem,
        alg: 'Ed25519',
      };
    },
    verifyReceipt(signed: SignedReceipt): boolean {
      try {
        const canonical = JSON.stringify(signed.payload);
        const pub = crypto.createPublicKey(signed.publicKeyPem);
        return crypto.verify(
          null,
          Buffer.from(canonical, 'utf8'),
          pub,
          Buffer.from(signed.signature, 'base64url')
        );
      } catch {
        return false;
      }
    },
  };
}
