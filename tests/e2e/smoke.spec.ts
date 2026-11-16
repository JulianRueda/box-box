import { expect, test } from '@playwright/test';

test('se puede recorrer la temporada: inicio → calendario → ronda → piloto → equipo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu campeonato.');

  await page.getByRole('navigation', { name: 'Navegación principal' }).first().getByRole('link', { name: 'Calendario' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendario' })).toBeVisible();

  await page.getByRole('link', { name: /Gran Premio de Australia/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gran Premio de Australia' })).toBeVisible();
  const race = page.getByRole('table', { name: /Carrera/ });
  await expect(race.getByRole('row')).toHaveCount(23); // cabecera + 22 coches

  await page.getByRole('tab', { name: 'Clasificación' }).click();
  await expect(page.getByRole('columnheader', { name: 'Q3' })).toBeVisible();

  await page.getByRole('tab', { name: 'Carrera' }).click();
  await race.getByRole('row').nth(1).getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 2, name: 'Atributos' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Gráfico de radar/ })).toBeVisible();

  await page.goto('/#/teams/cadillac');
  await expect(page.getByRole('heading', { level: 1, name: 'Cadillac' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'El coche' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('el selector de idioma cambia toda la interfaz y se recuerda', async ({ page }) => {
  await page.goto('/#/standings');
  await expect(page.getByRole('heading', { level: 1, name: 'Clasificación' })).toBeVisible();

  await page.getByRole('button', { name: 'en', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Standings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Standings' })).toBeVisible();
});

test('la clasificación retrocede a cualquier ronda', async ({ page }) => {
  await page.goto('/#/standings');
  const slider = page.getByRole('slider', { name: 'Ronda del mundial' });
  await slider.fill('1');
  await expect(page.getByRole('table', { name: 'Pilotos — Tras la ronda 1', exact: true })).toBeVisible();
  // Tras la primera carrera el líder tiene los 25 puntos de la victoria.
  const first = page.getByRole('table', { name: /Pilotos/ }).getByRole('row').nth(1);
  await expect(first).toContainText('25');
});
