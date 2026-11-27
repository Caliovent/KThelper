import { expect, test } from '@playwright/test';

test.describe('Constructeur Open & Défense vs 3-Bet / 4-Bet (Cash Game #2 & #3)', () => {
  test('création de spot, verrouillage hors-Open, adaptation Nit, drill et zéro débordement horizontal', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');

    // 1. Ouvrir l'onglet Constructeur Open & 4-Bet
    const modeBtn = page.locator('#btn-mode-builder3bet');
    await expect(modeBtn).toBeVisible();
    await modeBtn.click();

    const builder = page.getByTestId('range-3bet-builder');
    await expect(builder).toBeVisible();

    // Vérifier zéro débordement horizontal (Desktop & Mobile)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // 2. Créer un spot personnalisé
    await builder.getByTestId('btn-new-spot').click();
    await builder.getByTestId('input-new-spot-label').fill('CO vs BB E2E');
    await builder.getByTestId('btn-create-spot-submit').click();
    await expect(builder.getByTestId('spot-selector')).toContainText('CO vs BB E2E');

    // 3. Étape 1 : Modifier la range Open (retirer A5s ou ajouter A5s via notation puis vérifier)
    await builder.getByTestId('tab-step-open').click();
    const openMatrix = builder.getByTestId('builder-matrix-open');
    await expect(openMatrix).toBeVisible();

    const cellA5sOpen = openMatrix.locator('button[data-hand="A5s"]');
    const wasInOpen = (await cellA5sOpen.getAttribute('data-in-open')) === 'true';
    if (!wasInOpen) {
      await builder.getByTestId('open-brush-add').click();
      await cellA5sOpen.click();
    }
    await expect(cellA5sOpen).toHaveAttribute('data-in-open', 'true');

    // Vérifier une main hors Open (ex: 72o)
    const cell72oOpen = openMatrix.locator('button[data-hand="72o"]');
    await expect(cell72oOpen).toHaveAttribute('data-in-open', 'false');

    // 4. Étape 2 : Défense vs 3-Bet & 4-Bet
    await builder.getByTestId('tab-step-defense').click();
    const defMatrix = builder.getByTestId('builder-matrix-defense');
    await expect(defMatrix).toBeVisible();

    // 72o est grisée et disabled (impossible à peindre hors Open)
    const cell72oDef = defMatrix.locator('button[data-hand="72o"]');
    await expect(cell72oDef).toBeDisabled();
    await expect(cell72oDef).toHaveAttribute('data-in-open', 'false');

    // Peindre A5s en 4-Bet Bluff
    await builder.getByTestId('brush-fourbet_bluff').click();
    const cellA5sDef = defMatrix.locator('button[data-hand="A5s"]');
    await cellA5sDef.click();
    await expect(cellA5sDef).toHaveAttribute('data-action', 'fourbet_bluff');
    await expect(builder.getByTestId('stat-4bet-bluff-combos')).toContainText('4c');

    // 5. Adapter en 1 clic au profil Nit => 0 combos de 4-Bet bluff
    await builder.getByTestId('btn-profile-nit').click();
    await builder.getByTestId('btn-adapt-profile').click();
    await expect(builder.getByTestId('stat-4bet-bluff-combos')).toContainText('0c');

    // 6. Étape 3 : Serious Game — Tester ma Défense
    await builder.getByTestId('tab-step-drill').click();
    const drillPanel = builder.getByTestId('defense-drill-panel');
    await expect(drillPanel).toBeVisible();
    await expect(drillPanel.getByTestId('drill-hand-label')).toBeVisible();

    await drillPanel.getByTestId('drill-answer-fourbet_value').click();
    await expect(drillPanel.getByTestId('drill-feedback')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
