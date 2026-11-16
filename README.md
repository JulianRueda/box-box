# Paddock Manager 2026

Juego de gestión de Fórmula 1 en el navegador. Se construye por fases; esta es la **Fase 1 — Base y datos**.

## Cómo ejecutarlo

Requiere Node 20 o superior.

```bash
npm install
npm run dev        # abre http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests de humo en navegador (Playwright). La primera vez: `npx playwright install chromium` |
| `npm run update-season` | Trae calendario y resultados de Jolpica, muestra el diff y pregunta antes de escribir (`-- --yes` para no preguntar) |
| `npm run build-circuits` | Regenera los trazados de `data/circuits/` desde GeoJSON público |
| `npm run build-ratings` | Recalcula las valoraciones de coches, pilotos y staff |

Después de cada carrera real: `npm run update-season` y luego `npm run build-ratings`.

## Qué incluye la Fase 1

- **Temporada 2026 real** hasta la última ronda disputada: 11 equipos, 22 titulares más reservas, 23 rondas,
  resultados de carrera, clasificación y sprint, 77 personas de staff y 23 circuitos con su trazado.
- **Pantallas**: inicio, equipos y ficha de equipo, pilotos y ficha de piloto (casco generado, radar de atributos,
  contrato, temporada), calendario, ronda (resultados por sesión, circuito, mundial tras la ronda) y clasificación
  con control para retroceder a cualquier ronda.
- **Español e inglés** con selector; español por defecto.
- **Responsive**: navegación superior en escritorio e inferior en el celular.
- **Motor de clasificaciones** (`src/engine/season/`) puro y con tests: reproduce la clasificación oficial.

Los modos de juego aparecen en el inicio como pendientes, con la fase en la que llegan.

## Estructura

```
data/2026/            calendar.json y results.json (de la API) · teams, drivers, staff (generados)
data/2026/base/       datos curados a mano, con fuente en data/SOURCES.md
data/circuits/        un JSON por circuito
scripts/              update-season · build-circuits · build-ratings
src/data/             esquemas zod y carga validada
src/engine/           simulación pura, sin React ni DOM
src/ui/               componentes y pantallas
src/i18n/             es.json y en.json
tests/unit · tests/e2e
docs/                 RATINGS.md (fórmulas) · DECISIONS.md
```

## Logos de los equipos

No van en el repo porque son marcas registradas. Copia los tuyos en `public/assets/logos/` siguiendo
`public/assets/logos/README.md`; si falta alguno se dibuja un escudo con los colores y las siglas del equipo.

## Datos estimados

Nada real está inventado. Lo que no tiene fuente fiable está marcado en los JSON y la interfaz lo muestra con la
etiqueta **EST.** o **GENERADO**. El detalle, en `data/SOURCES.md` y `docs/RATINGS.md`.
