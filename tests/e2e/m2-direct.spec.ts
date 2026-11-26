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

    // Se connecter en L1 rapidement pour activer la session WebSocket
    await arenaRoot.getByRole('button', { name: /Classé L1 & Daily Officiel/i }).click();
    const uniq = `m2_${testInfo.project.name}_${browserName}_${Date.now().toString(36)}`
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 18);
    await arenaRoot.getByPlaceholder('joueur@exemple.fr').fill(`${uniq}@test.fr`);
    await arenaRoot.getByPlaceholder('Shark_KT').fill(uniq);
    await arenaRoot.getByRole('button', { name: /Demander lien de connexion L1/i }).click();
    await arenaRoot.getByRole('button', { name: /Valider la connexion L1/i }).click();
    await expect(arenaRoot.getByText(uniq)).toBeVisible();

    // Aller sur Live Arena & Revue (M2)
    await arenaRoot.getByRole('button', { name: /Live Arena & Revue \(M2\)/i }).click();
    await expect(arenaRoot.getByText(/WebSocket Connecté/i)).toBeVisible();
    await expect(arenaRoot.getByText(/0 sanction automatique/i)).toBeVisible();

    // Aller sur Radar & Détectives (M2)
    await arenaRoot.getByRole('button', { name: /Radar & Détectives \(M2\)/i }).click();
    await expect(arenaRoot.getByText(/Sans EV — Non éligible au classé/i)).toBeVisible();

    // Radar de Board (4 boards jumeaux)
    await arenaRoot.getByRole('button', { name: /Démarrer Radar de Board/i }).click();
    for (let b = 0; b < 4; b++) {
      await arenaRoot.getByRole('button', { name: /Passer à Phase 2/i }).click();
      await arenaRoot.getByRole('button', { name: /C-Bet 33%/i }).click();
    }
    await expect(arenaRoot.getByText('Débriefing Boards Jumeaux côte à côte (Non classé)')).toBeVisible();

    // Détectives (Entonnoir + Contre-enquête sur 3 rues)
    await arenaRoot.getByRole('button', { name: /Ouvrir l’enquête/i }).click();
    for (let s = 0; s < 3; s++) {
      await arenaRoot.getByRole('button', { name: /Soumettre estimation initiale/i }).click();
      await expect(arenaRoot.getByText(/Contre-enquête : aperçu/i)).toBeVisible();
      await arenaRoot.getByRole('button', { name: /Valider version finale/i }).click();
    }
    await expect(arenaRoot.getByText(/Bilan Entonnoir & Contre-enquête/i)).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
