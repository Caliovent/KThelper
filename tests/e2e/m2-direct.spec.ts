import { expect, test } from '@playwright/test';

test.describe('Jalon M2 Direct — Live Arena WS, Console de Revue, Radar & Détectives', () => {
  test('MP-20, MP-21, MP-22 : Live Arena WS connecté, Revue humaine & Jeux Radar/Détectives', async ({
    page,
    browserName,
  }, testInfo) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');

    // Se connecter au Profil Classé rapidement pour activer la salle Live
    await arenaRoot.getByRole('button', { name: /Arène Classée/i }).click();
    const uniq = `m2_${testInfo.project.name}_${browserName}_${Date.now().toString(36)}`
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 18);
    await arenaRoot.getByPlaceholder('joueur@exemple.fr').fill(`${uniq}@test.fr`);
    await arenaRoot.getByPlaceholder('Shark_KT').fill(uniq);
    await arenaRoot.getByRole('button', { name: /Recevoir mon accès rapide/i }).click();
    await arenaRoot.getByRole('button', { name: /Confirmer la connexion/i }).click();
    await expect(arenaRoot.getByText(uniq)).toBeVisible();

    // Aller sur Heads-Up Live
    await arenaRoot.getByRole('button', { name: /Heads-Up Live/i }).click();
    await expect(arenaRoot.getByText(/Salle Live prête/i)).toBeVisible();
    await expect(arenaRoot.getByText(/Aucune sanction automatique/i)).toBeVisible();

    // Aller sur Board & Hand Reading
    await arenaRoot.getByRole('button', { name: /Board & Hand Reading/i }).click();
    await expect(arenaRoot.getByText(/Entraînement tactique — Hors classement/i)).toBeVisible();

    // Lecture de Board (4 flops jumeaux)
    await arenaRoot.getByRole('button', { name: /Démarrer Lecture de Board/i }).click();
    for (let b = 0; b < 4; b++) {
      await arenaRoot.getByRole('button', { name: /Passer à l’étape 2/i }).click();
      await arenaRoot.getByRole('button', { name: /C-Bet 33%/i }).click();
    }
    await expect(arenaRoot.getByText('Débriefing Flops Jumeaux côte à côte')).toBeVisible();

    // Hand Reading (Entonnoir sur 3 rues + comparaison)
    await arenaRoot.getByRole('button', { name: /Analyser la main/i }).click();
    for (let s = 0; s < 3; s++) {
      await arenaRoot.getByRole('button', { name: /Verrouiller ma 1re lecture/i }).click();
      await expect(arenaRoot.getByText(/Comparaison : lecture d’un autre joueur/i)).toBeVisible();
      await arenaRoot.getByRole('button', { name: /Valider ma lecture finale/i }).click();
    }
    await expect(arenaRoot.getByText(/Bilan Hand Reading/i)).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
