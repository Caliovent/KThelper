import { expect, test } from '@playwright/test';

const FORBIDDEN_RUN_KEYS = new Set([
  'solution',
  'truthPct',
  'ev',
  'defaultAction',
  'reference',
  'tolerance',
  'zeroAt',
  'explanationText',
  'secretSeed',
  'pd',
  'loss',
  'lossUnit',
  'perfect',
  'totalPd',
]);

function checkNoForbiddenKeys(obj: unknown, path = 'root'): string | null {
  if (obj === null || obj === undefined || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const hit = checkNoForbiddenKeys(obj[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_RUN_KEYS.has(k)) return `${path}.${k}`;
    const hit = checkNoForbiddenKeys(v, `${path}.${k}`);
    if (hit) return hit;
  }
  return null;
}

test.describe('Jalon M1 Asynchrone — Classé L1, Daily Officiel, Fresque Duel & Salve 3-Max', () => {
  test('MP-12, MP-13, MP-16, MP-17 : Auth L1, Ghost Classé sans fuite réseau, Daily Officiel & Suppression RGPD', async ({
    page,
    browserName,
  }, testInfo) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    const leakedKeys: string[] = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/v1/runs/') && (url.endsWith('/open') || url.endsWith('/answer'))) {
        try {
          const json = await res.json();
          const hit = checkNoForbiddenKeys(json);
          if (hit) leakedKeys.push(`${url} -> ${hit}`);
        } catch {
          // ignore
        }
      }
    });

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');

    // Cocher l'engagement Anti-RTA (hors session room)
    await arenaRoot.locator('input[type="checkbox"]').first().check();

    // Basculer sur Classé L1 & Daily Officiel
    await arenaRoot.getByRole('button', { name: /Classé L1 & Daily Officiel/i }).click();
    await expect(arenaRoot.getByText(/Serveur L1 connecté/i)).toBeVisible();

    const uniq = `${testInfo.project.name}_${browserName}_${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18);
    await arenaRoot.getByPlaceholder('joueur@exemple.fr').fill(`${uniq}@test.fr`);
    await arenaRoot.getByPlaceholder('Shark_KT').fill(uniq);
    await arenaRoot.getByRole('button', { name: /Demander lien de connexion L1/i }).click();
    await arenaRoot.getByRole('button', { name: /Valider la connexion L1/i }).click();
    await expect(arenaRoot.getByText(uniq)).toBeVisible();

    // Lancer un Ghost Classé L1 et jouer les 15 spots avec vérification d'absence de fuite réseau
    await arenaRoot.getByRole('button', { name: /Lancer \/ Apparier un Ghost Classé L1/i }).click();
    await expect(arenaRoot.getByText(/Run Autoritaire L1 \(Ghost Classé\)/i)).toBeVisible();

    // Anti-RTA actif sur onglet externe pendant le run L1
    await page.locator('#tab-btn-icm').click();
    await expect(page.locator('#suite-tab-icm')).toBeHidden();

    for (let i = 0; i < 15; i++) {
      await expect(arenaRoot.getByText(new RegExp(`Spot ${i + 1} / 15`))).toBeVisible();
      const input = arenaRoot.locator('input[type="number"]');
      await input.fill('50');
      await input.press('Enter');
    }

    await expect(
      arenaRoot.getByText(/Votre série Ghost L1 est enregistrée|Match Ghost L1 réglé ! Reçu Ed25519 vérifié/i)
    ).toBeVisible();
    expect(leakedKeys).toHaveLength(0);

    // Démarrer le Daily Top Officiel et vérifier la consommation unique après 15 spots
    await arenaRoot.getByRole('button', { name: /Démarrer mon essai officiel Daily Top/i }).click();
    await expect(arenaRoot.getByText(/Run Autoritaire L1 \(Daily Top Officiel\)/i)).toBeVisible();
    for (let i = 0; i < 15; i++) {
      await expect(arenaRoot.getByText(new RegExp(`Spot ${i + 1} / 15`))).toBeVisible();
      const input = arenaRoot.locator('input[type="number"]');
      await input.fill('48');
      await input.press('Enter');
    }
    await expect(arenaRoot.getByText(/Essai officiel du jour déjà consommé/i)).toBeVisible();

    // Suppression RGPD (MP-12)
    await arenaRoot.getByRole('button', { name: /Supprimer mon compte/i }).click();
    await arenaRoot.getByRole('button', { name: /Confirmer suppression définitive/i }).click();
    await expect(arenaRoot.getByText(/Compte supprimé/i)).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('MP-19 : Parcours graphiques Fresque Duel (amical only) & Salve 3-Max (15 spots)', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');
    await arenaRoot.getByRole('button', { name: /Fresque & Salve/i }).click();

    await expect(arenaRoot.getByText(/Fresque impossible en classé/i)).toBeVisible();
    await arenaRoot.getByRole('button', { name: /Lancer Fresque Duel/i }).click();

    for (let l = 1; l <= 6; l++) {
      await arenaRoot.getByRole('button', { name: new RegExp(`Valider cette ligne \\(${l}/6\\)`) }).click();
    }
    await expect(arenaRoot.getByText(/Score Fresque Duel \(Amical L0\)/i)).toBeVisible();

    // Salve 3-Max (15 spots)
    await arenaRoot.getByRole('button', { name: /Démarrer Salve 3-Max/i }).click();
    for (let i = 1; i <= 15; i++) {
      await expect(arenaRoot.getByText(new RegExp(`Spot ${i} / 15`))).toBeVisible();
      await arenaRoot.getByRole('button', { name: /Fold/i }).click();
    }
    await expect(arenaRoot.getByText(/Résultat Salve/i)).toBeVisible();
    await expect(arenaRoot.getByText(/1\.35 point/i).first()).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
