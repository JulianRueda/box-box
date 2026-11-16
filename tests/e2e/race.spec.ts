import { expect, test } from '@playwright/test';

test('partida rápida: empezar, acelerar, pedir boxes y pausar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#/race');
  await expect(page.getByRole('heading', { level: 1, name: 'Partida rápida' })).toBeVisible();
  await page.getByRole('radio', { name: 'McLaren' }).click();
  await expect(page.getByRole('radiogroup', { name: /Estrategia: Lando Norris/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Siempre seco' }).click();
  await page.getByRole('button', { name: 'Empezar carrera' }).click();

  // La carrera arranca y el mapa existe.
  await expect(page.getByText(/Vuelta 1 \/ \d+/)).toBeVisible();
  await expect(page.getByRole('img', { name: 'Mapa del circuito' })).toBeVisible();

  await page.getByRole('button', { name: 'x16' }).click();
  await expect(page.getByText(/Vuelta 3 \/ \d+/)).toBeVisible({ timeout: 40_000 });

  // La torre tiene los 22 coches y los dos del jugador tienen panel.
  await expect(page.getByRole('list').first().getByRole('listitem')).toHaveCount(22);
  const norris = page.getByRole('region', { name: 'NOR' });
  await expect(norris).toBeVisible();
  await expect(page.getByRole('region', { name: 'PIA' })).toBeVisible();

  // Orden de boxes con neumático duro.
  await norris.getByRole('button', { name: 'Parar esta vuelta: Duro' }).click();
  await expect(norris.getByText('Parada pedida')).toBeVisible();
  await expect(page.getByText(/NOR en boxes · Duro/)).toBeVisible({ timeout: 30_000 });

  // Cambio de ritmo y pausa.
  await norris.getByRole('group', { name: 'Ritmo' }).getByRole('button', { name: 'Empujar' }).click();
  await expect(norris.getByRole('group', { name: 'Ritmo' }).getByRole('button', { name: 'Empujar' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Pausa' }).click();
  await expect(page.getByRole('button', { name: 'Reanudar' })).toBeVisible();
  const lap = await page.getByText(/Vuelta \d+ \/ \d+/).textContent();
  await page.waitForTimeout(1500);
  expect(await page.getByText(/Vuelta \d+ \/ \d+/).textContent()).toBe(lap);

  expect(errors).toEqual([]);
});
