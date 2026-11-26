import { QUOTAS } from './config';
import { rngFrom, shuffle } from './rng';

export type Bucket = keyof typeof QUOTAS;

export interface Template {
  id: string;
  skillId: string;
  family: string;
  bucket: Bucket;
  ranked: boolean;
}

/** Plus forts restes ; égalité départagée par l'ordre de QUOTAS. */
export function quotas(n: number): Record<Bucket, number> {
  const keys = Object.keys(QUOTAS) as Bucket[];
  const pct = keys.map((k) => Math.round(QUOTAS[k] * 100));
  const out = pct.map((p) => Math.floor((n * p) / 100));
  const order = keys
    .map((_, i) => i)
    .sort((i, j) => ((n * pct[j]) % 100) - ((n * pct[i]) % 100) || i - j);
  for (let k = 0; out.reduce((a, b) => a + b, 0) < n; k++) out[order[k]]++;
  return Object.fromEntries(keys.map((k, i) => [k, out[i]])) as Record<Bucket, number>;
}

const byId = <T extends Template>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class PoolTooSmall extends Error {}

export async function selectSeries<T extends Template>(
  pool: readonly T[],
  n: number,
  seed: string,
  corpusVersion: string,
  generatorVersion: string,
  rankedOnly: boolean
): Promise<T[]> {
  const rng = await rngFrom(seed, corpusVersion, generatorVersion);
  const eligible = pool.filter((t) => !rankedOnly || t.ranked).sort(byId);
  const q = quotas(n);
  const skills = new Set<string>();
  const fam = new Map<string, number>();
  const maxFam = Math.ceil(n / 3);
  const picked: T[] = [];

  for (const b of Object.keys(q) as Bucket[]) {
    let need = q[b];
    for (const t of shuffle(rng, eligible.filter((item) => item.bucket === b))) {
      if (!need) break;
      if (skills.has(t.skillId) || (fam.get(t.family) ?? 0) >= maxFam) continue;
      picked.push(t);
      skills.add(t.skillId);
      fam.set(t.family, (fam.get(t.family) ?? 0) + 1);
      need--;
    }
    if (need) throw new PoolTooSmall(`${b}: il manque ${need} gabarits`);
  }

  const rest = shuffle(rng, picked);
  const out: T[] = [];
  while (rest.length) {
    const i = rest.findIndex((t) => t.family !== out.at(-1)?.family);
    out.push(...rest.splice(Math.max(i, 0), 1));
  }
  return out;
}
