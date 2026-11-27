import { expect, test } from '@playwright/test';

test.describe('Range Évolutif & Entonnoir de Board (Street-by-Street Matrix Diff)', () => {
  test('Stepper 4 rues, calque fantôme, card removal KJs/K♣, vue 4 mini-matrices & Défi Entonnoir', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');

    // 1. Ouvrir le sous-mode Entonnoir 4 Rues dans l'onglet Ranges & Quiz
    await page.locator('#btn-mode-funnel').click();
    const lab = page.locator('#evolutionary-funnel-lab');
    await expect(lab).toBeVisible();

    // 2. Vérifier le spot de Shishi par défaut (Turn K♣ sélectionné, KJs épinglée)
    await expect(
      lab.getByRole('heading', { name: /Spot Shishi — Triple Barrel/i })
    ).toBeVisible();
    await expect(lab.locator('#funnel-inspected-hand')).toHaveText('KJs');
    await expect(lab.locator('#funnel-family-summary')).toContainText('12 / 16 combos');
    await expect(lab.locator('#funnel-family-summary')).toContainText('-4 card removal');

    // 3. Vérifier le calque fantôme (.funnel-cell-ghost) sur les mains éliminées à cette rue (ex: 77 au Turn)
    const ghostCount = await lab.locator('#funnel-diff-matrix .funnel-cell-ghost').count();
    expect(ghostCount).toBeGreaterThan(5);

    // 4. Vérifier le stepper & le raccourci clavier ArrowRight -> River A♥
    await page.locator('#evolutionary-funnel-lab').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ArrowRight');
    await expect(lab.locator('#funnel-street-slider')).toHaveValue('3');
    await expect(lab.getByText(/RIVER : A♥/i).first()).toBeVisible();

    // Retour Flop via clic stepper pour inspecter 44 (fantôme)
    await lab.locator('[data-street-step="1"]').click();
    await expect(lab.locator('#funnel-street-slider')).toHaveValue('1');
    const cell44 = lab.locator('#funnel-diff-matrix [data-hand="44"]');
    await expect(cell44).toHaveAttribute('data-status', 'eliminated_prev');
    await cell44.click();
    await expect(lab.locator('#funnel-inspected-hand')).toHaveText('44');

    // 5. Basculer vers Vue Entonnoir (4 mini-matrices côte à côte)
    await lab.locator('#funnel-view-compare-btn').click();
    const compareGrid = lab.locator('#funnel-compare-grid');
    await expect(compareGrid).toBeVisible();
    await expect(compareGrid.locator('.matrix-grid')).toHaveCount(4);

    // 6. Ouvrir Défi Entonnoir (Serious Game) et répondre à la question 1
    await lab.locator('#funnel-view-quiz-btn').click();
    const quizBox = lab.locator('#funnel-quiz-workspace');
    await expect(quizBox).toBeVisible();
    const firstQ = quizBox.locator('[data-funnel-question="shishi_q1_kj_removal"]');
    await firstQ.getByRole('button', { name: /KJs = 3 combos/i }).click();
    await expect(firstQ.getByText(/supprime exactement 1 combo/i)).toBeVisible();
    await expect(lab.locator('#funnel-view-quiz-btn')).toContainText('1/3');

    // Aucun débordement horizontal sur mobile ni erreur console
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });
});
