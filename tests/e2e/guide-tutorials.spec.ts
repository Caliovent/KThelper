import { expect, test } from '@playwright/test';

test.describe('Centre d’Aide & Tutoriels Interactifs — Tests E2E', () => {
  test('Recherche formules (MDF/Bubble Factor), navigation module, tour interactif 6 étapes & verrou Anti-RTA', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');

    // 1. Ouverture du Centre d'Aide
    await page.locator('#nav-btn-guide').click();
    const modal = page.locator('#guide-docs-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/0\/4 tutoriels complétés/i)).toBeVisible();

    // 2. Recherche instantanée MDF et Bubble Factor
    const searchInput = modal.getByLabel(/Rechercher dans la documentation/i);
    await searchInput.fill('MDF');
    await expect(modal.getByText('MDF = Pot / (Pot + Mise adverse)')).toBeVisible();

    await searchInput.fill('Bubble Factor');
    await expect(modal.getByText(/Bubble Factor \(BF\)/i).first()).toBeVisible();
    await searchInput.fill('');

    // 3. Guide des Modules -> Ouvrir ICM & PKO Lab
    await modal.getByRole('button', { name: /Guide des Modules/i }).click();
    await modal.getByRole('button', { name: /Ouvrir ce module/i }).nth(1).click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#suite-tab-icm')).toBeVisible();

    // 4. Lancer le Tour complet de la Suite (6 étapes) et le terminer
    await page.locator('#nav-btn-guide').click();
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /Tutoriels Interactifs/i }).click();
    await modal.getByRole('button', { name: /Démarrer le tuto/i }).first().click();

    const tourCard = page.locator('#interactive-tour-card');
    await expect(tourCard).toBeVisible();
    await expect(tourCard.getByText(/Étape 1 \/ 6/i)).toBeVisible();
    await expect(page.locator('#suite-tab-ranges')).toBeVisible();

    await tourCard.getByRole('button', { name: /Suivant/i }).click();
    await expect(tourCard.getByText(/Étape 2 \/ 6/i)).toBeVisible();

    await tourCard.getByRole('button', { name: /Suivant/i }).click();
    await expect(tourCard.getByText(/Étape 3 \/ 6/i)).toBeVisible();
    await expect(page.locator('#suite-tab-icm')).toBeVisible();

    await tourCard.getByRole('button', { name: /Suivant/i }).click();
    await expect(tourCard.getByText(/Étape 4 \/ 6/i)).toBeVisible();
    await expect(page.locator('#suite-tab-bankroll')).toBeVisible();

    await tourCard.getByRole('button', { name: /Suivant/i }).click();
    await expect(tourCard.getByText(/Étape 5 \/ 6/i)).toBeVisible();
    await expect(page.locator('#suite-tab-gto')).toBeVisible();

    await tourCard.getByRole('button', { name: /Suivant/i }).click();
    await expect(tourCard.getByText(/Étape 6 \/ 6/i)).toBeVisible();
    await expect(page.locator('#suite-tab-arena')).toBeVisible();

    await tourCard.getByRole('button', { name: /Terminer le tuto/i }).click();
    await expect(tourCard).toBeHidden();

    // Progression persistée (1/4 complété)
    await page.locator('#nav-btn-guide').click();
    await expect(modal.getByText(/1\/4 tutoriels complétés/i)).toBeVisible();
    await modal.getByRole('button', { name: /Fermer le Centre d’Aide/i }).click();

    // 5. Verrou Anti-RTA : impossible d'ouvrir le Guide pendant un duel actif
    const arenaRoot = page.locator('#suite-tab-arena');
    await arenaRoot.locator('input[type="checkbox"]').first().check();
    await arenaRoot.getByRole('button', { name: 'Démarrer l’échauffement (6 spots)' }).click();
    await expect(arenaRoot.getByText(/Duel d’entraînement en cours/i)).toBeVisible();

    await page.locator('#nav-btn-guide').click();
    await expect(modal).toBeHidden();

    expect(errors).toHaveLength(0);
  });
});
