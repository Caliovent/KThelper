import { expect, test } from '@playwright/test';

test.describe('PALM-Funnel — Range Évolutif & 4 Modes Progressifs', () => {
  test('Stepper clavier (< 5ms), Fantôme, KJs vs KJ et parcours complet des 4 modes PALM-Funnel', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');

    // 1. Ouvrir l'onglet Entonnoir 4 Rues
    await page.locator('#btn-mode-funnel').click();
    const lab = page.locator('#evolutionary-funnel-lab');
    await expect(lab).toBeVisible();
    await expect(
      lab.getByRole('heading', { name: /Spot Shishi — Triple Barrel/i })
    ).toBeVisible();

    // Vérifier distinction cellule KJs (4 -> 4 -> 3) vs famille KJ (12 / 16)
    await expect(lab.locator('#funnel-inspected-hand')).toHaveText('KJs');
    await expect(lab.locator('#funnel-inspected-active-combos')).toContainText('3 combos dispo');
    await expect(lab.locator('#funnel-family-summary')).toContainText('12 / 16 combos');

    // Calque fantôme présent à l'écran
    expect(await lab.locator('#funnel-diff-matrix .funnel-cell-ghost').count()).toBeGreaterThan(5);

    // Navigation clavier <- / -> et mesure du budget moteur (< 5 ms par transition)
    await page.keyboard.press('ArrowRight');
    await expect(lab.locator('#funnel-street-slider')).toHaveValue('3');
    await page.keyboard.press('ArrowLeft');
    await expect(lab.locator('#funnel-street-slider')).toHaveValue('2');

    const avgTransitionMs = await page.evaluate(() => {
      const api = (window as unknown as {
        ProPokerV2?: {
          EVOLUTIONARY_FUNNEL_SCENARIOS: readonly unknown[];
          computeStreetMatrixDiff: (sc: unknown, st: 0 | 1 | 2 | 3) => unknown;
        };
      }).ProPokerV2;
      if (!api) return 999;
      const sc = api.EVOLUTIONARY_FUNNEL_SCENARIOS[0];
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) {
        api.computeStreetMatrixDiff(sc, (i % 4) as 0 | 1 | 2 | 3);
      }
      return (performance.now() - t0) / 20;
    });
    expect(avgTransitionMs).toBeLessThan(5);

    // Bascule Vue Entonnoir (4 mini-matrices côte à côte)
    await lab.locator('#funnel-view-compare-btn').click();
    await expect(lab.locator('#funnel-compare-grid .matrix-grid')).toHaveCount(4);

    // Mode 1 : Le Sismographe de Contraste (1 rue masquée -> révélée après réponse)
    await lab.locator('#funnel-mode-sismographe-btn').click();
    const sismoWs = lab.locator('#funnel-sismographe-workspace');
    await expect(sismoWs.locator('[data-masked="true"]')).toHaveCount(1);
    await sismoWs
      .getByRole('button', { name: /Les paires intermédiaires/i })
      .click();
    await expect(sismoWs.locator('[data-masked="true"]')).toHaveCount(0);

    // Mode 2 : Le Scalpel par Tiroirs (élagage sans clic 169× -> FSRS + déblocage chrono)
    await lab.locator('#funnel-mode-scalpel-btn').click();
    const scalpelWs = lab.locator('#funnel-scalpel-workspace');
    await expect(scalpelWs.locator('#funnel-scalpel-timer-btn')).toBeDisabled();
    // Régler les tiroirs principaux pour atteindre >= 80% sur Shishi Turn Kc
    await scalpelWs
      .locator('[data-drawer-id="sets_overpairs"]')
      .getByRole('button', { name: '100%', exact: true })
      .click();
    await scalpelWs
      .locator('[data-drawer-id="top_pairs"]')
      .getByRole('button', { name: '100%', exact: true })
      .click();
    await scalpelWs
      .locator('[data-drawer-id="draws"]')
      .getByRole('button', { name: '75%', exact: true })
      .click();
    await scalpelWs
      .locator('[data-drawer-id="mid_pairs"]')
      .getByRole('button', { name: '25%', exact: true })
      .click();
    await scalpelWs
      .locator('[data-drawer-id="overcards_bd"]')
      .getByRole('button', { name: '25%', exact: true })
      .click();
    await scalpelWs
      .locator('[data-drawer-id="air"]')
      .getByRole('button', { name: '0%', exact: true })
      .click();

    await scalpelWs.locator('#funnel-scalpel-validate-btn').click();
    await expect(scalpelWs.locator('#funnel-scalpel-result')).toBeVisible();
    await expect(scalpelWs.locator('#funnel-scalpel-timer-btn')).toBeEnabled();

    // Mode 3 : L'Œil du Bloqueur (Micro-drill 5s computed)
    await lab.locator('#funnel-mode-blocker-btn').click();
    const blockerWs = lab.locator('#funnel-blocker-workspace');
    await expect(blockerWs).toBeVisible();
    await blockerWs.getByRole('button', { name: '12 combos' }).click();
    await expect(blockerWs.getByText(/K♣ retire 1 Roi du paquet/i)).toBeVisible();

    // Mode 4 : L'Arbitre River (Fréquences naturelles & décision EV)
    await lab.locator('#funnel-mode-river-btn').click();
    const riverWs = lab.locator('#funnel-river-workspace');
    await expect(riverWs).toBeVisible();
    await expect(riverWs.getByText(/Cote requise : 30\.0%/i)).toBeVisible();
    await riverWs.getByRole('button', { name: /Payer \(Bluff-Catch EV\+\)/i }).click();
    await expect(riverWs.locator('#funnel-river-feedback')).toBeVisible();

    // Aucun débordement horizontal mobile ni erreur JS
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });
});
