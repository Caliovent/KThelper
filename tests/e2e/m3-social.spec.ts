import { expect, test } from '@playwright/test';

test.describe('Jalon M3 Social — Boss sur rails, Écurie L1 & Défis historiques >= 24h', () => {
  test('MP-23, MP-24, MP-25 : Parcours Boss sur rails + Écurie L1 + Partage Winamax > 24h & vote', async ({
    page,
    browserName,
  }, testInfo) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');

    // Se connecter au Profil Classé pour activer Clubs & Hand Reviews
    await arenaRoot.getByRole('button', { name: /Arène Classée/i }).click();
    const uniq = `m3_${testInfo.project.name}_${browserName}_${Date.now().toString(36)}`
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 18);
    await arenaRoot.getByPlaceholder('joueur@exemple.fr').fill(`${uniq}@test.fr`);
    await arenaRoot.getByPlaceholder('Shark_KT').fill(uniq);
    await arenaRoot.getByRole('button', { name: /Recevoir mon accès rapide/i }).click();
    await arenaRoot.getByRole('button', { name: /Confirmer la connexion/i }).click();
    await expect(arenaRoot.getByText(uniq)).toBeVisible();

    // Aller sur Table des Boss & Club
    await arenaRoot.getByRole('button', { name: /Table des Boss & Club/i }).click();
    await expect(arenaRoot.getByText(/Table des Boss — Défi Multi-Streets/i)).toBeVisible();

    // Jouer la Table des Boss (3 mains x 3 décisions)
    await arenaRoot.getByRole('button', { name: /Affronter ce Boss/i }).click();
    await expect(arenaRoot.getByText(/La main continue sur la ligne de référence/i)).toBeVisible();
    for (let hand = 0; hand < 3; hand++) {
      for (let step = 0; step < 3; step++) {
        await arenaRoot.locator('button').filter({ hasText: /Open|C-Bet|Fold|Iso|Bet|Call|Raise|Value/i }).first().click();
      }
    }
    await expect(arenaRoot.getByText(/Boss vaincu|Échec validation/i)).toBeVisible();

    // Créer un Club avec un nom unique par run (desktop & mobile partagent le serveur E2E)
    await arenaRoot.getByLabel(/Nom du Club/i).fill(`Club_${uniq}`);
    await arenaRoot.getByRole('button', { name: /Créer le Club/i }).click();
    await expect(arenaRoot.getByText(/Club créé !/i)).toBeVisible();

    // Charger exemple Winamax (> 24h), publier et voter
    await arenaRoot.getByRole('button', { name: /Charger exemple Winamax/i }).click();
    await arenaRoot.getByRole('button', { name: /Publier pour avis du Club/i }).click();
    const previewPre = await arenaRoot.locator('pre').textContent();
    expect(previewPre).toBeTruthy();
    expect(previewPre).not.toMatch(/PseudoHeroPrive|JoueurSBPrive|RegBBPrive|20261120-9911/);

    await arenaRoot.getByRole('button', { name: /^bet$/i }).click();
    await expect(arenaRoot.getByText(/une majorité n’est pas une solution/i)).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
