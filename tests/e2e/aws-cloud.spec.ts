import { expect, test } from '@playwright/test';

test.describe('Cloud AWS (L0 Amical ktp-backend + File IndexedDB)', () => {
  test('Création défi, run déterministe, checksum SHA-256, file hors-ligne IndexedDB & sync', async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    let offlineMode = false;
    let submittedChecksum = '';
    const boardEntries: { rank: number; playerId: string; gtoElo: number }[] = [
      { rank: 1, playerId: 'seed_leader', gtoElo: 1540 },
    ];

    await page.route('**/api/ktp-aws/**', async (route) => {
      if (offlineMode) {
        await route.abort('failed');
        return;
      }
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname === '/api/ktp-aws/leaderboard') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            league: url.searchParams.get('league') ?? 'all_around',
            updatedAt: new Date().toISOString(),
            entries: boardEntries,
          }),
        });
        return;
      }
      if (url.pathname === '/api/ktp-aws/challenges' && req.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            challengeId: 'awsDemo01',
            seed: 'aws-seed-demo-01',
            variant: 'all_around',
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
          }),
        });
        return;
      }
      if (url.pathname === '/api/ktp-aws/challenges/awsDemo01/submit' && req.method() === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}') as {
          playerId?: string;
          clientChecksum?: string;
        };
        submittedChecksum = body.clientChecksum ?? '';
        boardEntries.push({ rank: 2, playerId: body.playerId ?? 'local', gtoElo: 1512 });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accepted: true,
            gtoEloDelta: 12,
            gtoElo: 1512,
            rank: 2,
            leagueId: 'all_around',
          }),
        });
        return;
      }
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
    });

    await page.goto('/');
    await page.locator('#tab-btn-arena').click();
    const arenaRoot = page.locator('#suite-tab-arena');
    await arenaRoot.locator('input[type="checkbox"]').first().check();

    await arenaRoot.getByRole('button', { name: /Défis Rapides/i }).click();
    await expect(arenaRoot.getByText(/Défis Rapides Partagés • Mode Amical/i)).toBeVisible();
    await expect(arenaRoot.getByText(/seed_leader/i)).toBeVisible();

    // Créer et jouer en ligne
    await arenaRoot.getByRole('button', { name: /Créer un défi à partager/i }).click();
    await expect(arenaRoot.getByText(/Code du défi : awsDemo01/i)).toBeVisible();
    await arenaRoot.getByRole('button', { name: /Jouer ce défi \(6 spots/i }).click();

    // Anti-RTA actif pendant le run AWS
    await page.locator('#tab-btn-icm').click();
    await expect(page.locator('#suite-tab-icm')).toBeHidden();

    for (let i = 0; i < 6; i++) {
      await expect(arenaRoot.getByText(new RegExp(`Spot ${i + 1} / 6`))).toBeVisible();
      const input = arenaRoot.locator('input[type="number"]');
      await input.fill('50');
      await input.press('Enter');
    }

    await expect(arenaRoot.getByText(/Score enregistré sur le classement amical/i)).toBeVisible();
    await expect(arenaRoot.getByText(/ELO Amical : 1512/i).first()).toBeVisible();
    expect(submittedChecksum).toMatch(/^[a-f0-9]{64}$/);

    // Simulation hors-ligne -> mise en file locale
    offlineMode = true;
    await arenaRoot.getByRole('button', { name: /Jouer ce défi \(6 spots/i }).click();
    for (let i = 0; i < 6; i++) {
      const input = arenaRoot.locator('input[type="number"]');
      await input.fill('45');
      await input.press('Enter');
    }
    await expect(arenaRoot.getByText(/En attente d’envoi : 1/i)).toBeVisible();

    // Rétablissement réseau + flush manuel
    offlineMode = false;
    await arenaRoot.getByRole('button', { name: /^Synchroniser$/i }).click();
    await expect(arenaRoot.getByText(/En attente d’envoi : 0/i)).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
