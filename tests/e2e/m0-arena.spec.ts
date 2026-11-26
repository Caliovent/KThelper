import { expect, test } from '@playwright/test';

test.describe('Pro Poker Suite V2 & Arène M0 Local — Tests graphiques E2E', () => {
  test('MP-01 & V2 Solo : drapeau mp=0 masque Arène, matrice 13x13, ICM 2.377 et Backup JSON V3', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/?mp=0');
    await expect(page.locator('#tab-btn-arena')).toBeHidden();
    await expect(page.locator('#hand-matrix .hand-cell')).toHaveCount(169);

    await page.locator('#tab-btn-icm').click();
    await expect(page.locator('#suite-tab-icm')).toBeVisible();
    await expect(page.locator('#v2-icm-bf')).toHaveText('1.490');
    await page.locator('#suite-tab-icm').getByRole('button', { name: /Bulle 4-Max/i }).click();
    await expect(page.locator('#v2-icm-bf')).toHaveText('2.377');

    await page.locator('#nav-btn-v2-backup').click();
    await expect(page.locator('#v2-backup-modal')).toBeVisible();
    const rawPreview = await page.locator('#v2-backup-json-preview').inputValue();
    const parsed = JSON.parse(rawPreview) as {
      schemaVersion: number;
      legacyV1Keys: Record<string, unknown>;
    };
    expect(parsed.schemaVersion).toBe(3);
    for (const key of [
      'killtilt_nl2_ranges_v1',
      'killtilt_quiz_xp_v1',
      'killtilt_watched_videos_v1',
      'killtilt_nl2_sessions_v1',
      'killtilt_nl2_start_br_v1',
      'killtilt_range_mastery_v1',
      'killtilt_coach_reviews_v1',
    ]) {
      expect(key in parsed.legacyV1Keys).toBe(true);
    }

    expect(errors).toHaveLength(0);
  });

  test('MP-03 : vecteurs RNG WebCrypto exacts dans Chromium réel', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { ProPokerV2?: unknown }).ProPokerV2));

    const result = await page.evaluate(async () => {
      const api = (window as unknown as {
        ProPokerV2: {
          mp: {
            rngFrom: (...parts: string[]) => Promise<() => number>;
            shuffle: <T>(rng: () => number, xs: readonly T[]) => T[];
          };
        };
      }).ProPokerV2;
      const r1 = await api.mp.rngFrom('kill-tilt', 'v1');
      const v1 = [r1(), r1(), r1(), r1()];
      const r2 = await api.mp.rngFrom('v');
      const s2 = api.mp.shuffle(r2, [0, 1, 2, 3, 4, 5, 6, 7]);
      return { v1, s2 };
    });

    expect(result.v1).toEqual([1005323447, 2164938751, 1576182334, 283372254]);
    expect(result.s2).toEqual([3, 7, 2, 0, 4, 1, 6, 5]);
  });

  test('MP-07, MP-08, MP-09 : parcours graphique Arène 6 spots, verrou Anti-RTA, débriefing & Ghost KT2.', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');
    await expect(arenaRoot).toBeVisible();

    // Sans engagement coché, refus de lancer
    await arenaRoot.getByRole('button', { name: 'Démarrer (6 spots)' }).click();
    await expect(arenaRoot.getByText(/Confirmez d’abord l’engagement/i)).toBeVisible();

    // Cocher l'engagement et démarrer
    await arenaRoot.locator('input[type="checkbox"]').first().check();
    await arenaRoot.getByRole('button', { name: 'Démarrer (6 spots)' }).click();

    // Run actif : verrouillage Anti-RTA des onglets externes & taille tactile >= 44px
    await expect(arenaRoot.getByText(/Run en cours \(L0 local\)/i)).toBeVisible();
    await page.locator('#tab-btn-icm').click();
    await expect(page.locator('#suite-tab-icm')).toBeHidden();

    const sureBtn = arenaRoot.getByRole('button', { name: /Sûr de mon calcul/i });
    const box = await sureBtn.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Résoudre les 6 spots via Entrée sur le champ numérique
    for (let i = 0; i < 6; i++) {
      await expect(arenaRoot.getByText(new RegExp(`Spot ${i + 1} / 6`))).toBeVisible();
      const numInput = arenaRoot.locator('input[type="number"]');
      await numInput.fill('52');
      await numInput.press('Enter');
    }

    // Débriefing MP-08 : 3 blocs verdict, SVG, réactions, code Ghost KT2.
    await expect(arenaRoot.getByText('1. Résultat')).toBeVisible();
    await expect(arenaRoot.getByText('2. Une décision réussie')).toBeVisible();
    await expect(arenaRoot.getByText('3. Une règle à retravailler')).toBeVisible();
    await expect(arenaRoot.locator('svg[viewBox="0 0 560 150"]')).toBeVisible();
    await expect(arenaRoot.getByRole('button', { name: 'Bien joué' })).toBeVisible();

    const kt2Input = arenaRoot.locator('input[readonly]');
    const kt2Token = await kt2Input.inputValue();
    expect(kt2Token.startsWith('KT2.')).toBe(true);

    // Fermer débriefing et réimporter le code KT2. (MP-09)
    await arenaRoot.getByRole('button', { name: 'Fermer' }).click();
    await arenaRoot.getByPlaceholder(/Collez ici un code KT2/i).fill(kt2Token);
    await arenaRoot.getByRole('button', { name: 'Valider Zod' }).click();
    await expect(arenaRoot.getByText(/Non vérifié \(L0 hors-ligne\)/i)).toBeVisible();
    await expect(arenaRoot.getByRole('button', { name: 'Relever ce Ghost' })).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('MP-10 & MP-11 : Daily local L0, journal FSRS V3 & Écuries pseudonymisation >= 24h', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');

    // Daily local L0 sans classement
    await arenaRoot.getByRole('button', { name: /Daily Local \(L0\)/i }).click();
    await expect(arenaRoot.getByText(/sans classement officiel/i)).toBeVisible();

    // FSRS V3 stats
    await arenaRoot.getByRole('button', { name: /Ligues & Journal FSRS V3/i }).click();
    await expect(arenaRoot.getByText('PROVISIONAL', { exact: true })).toBeVisible();
    await expect(arenaRoot.getByText('CONFIRMED', { exact: true })).toBeVisible();

    // Quêtes & Écuries + share.ts >= 24h sans fuite de pseudo
    await arenaRoot.getByRole('button', { name: /Quêtes & Écuries/i }).click();
    await expect(arenaRoot.getByText('Zéro Tilt')).toBeVisible();
    await arenaRoot.getByRole('button', { name: /Créer mon Écurie/i }).click();
    await arenaRoot.getByRole('button', { name: /Exemple Winamax/i }).click();
    await arenaRoot.getByRole('button', { name: /Vérifier Aperçu & Publier/i }).click();

    const preJson = await arenaRoot.locator('pre').textContent();
    expect(preJson).toBeTruthy();
    expect(preJson).toContain('"heroLabel": "BTN"');
    expect(preJson).not.toMatch(/MonPseudoReel|JoueurSB|RegBB|20261120-8421/);

    expect(errors).toHaveLength(0);
  });
});
