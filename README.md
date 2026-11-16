# Paddock Manager 2026

Juego de gestión de Fórmula 1 en el navegador. Se construye por fases; van hechas la **Fase 1 — Base y datos** y la **Fase 2 — Carrera en vivo con mapa**.

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
| `npm run update-race-facts` | Trae de OpenF1 las paradas y stints reales de cada carrera |
| `npm run build-ratings` | Recalcula las valoraciones de coches, pilotos y staff |
| `npm run calibrate` | 200 simulaciones de cada GP contra la carrera real; escribe `docs/CALIBRATION.md` (unos 25 min; `-- --n 20` para una pasada rápida) |

Después de cada carrera real: `npm run update-season`, `npm run update-race-facts` y `npm run build-ratings`.

## Qué incluye la Fase 1

- **Temporada 2026 real** hasta la última ronda disputada: 11 equipos, 22 titulares más reservas, 23 rondas,
  resultados de carrera, clasificación y sprint, 77 personas de staff y 23 circuitos con su trazado.
- **Pantallas**: inicio, equipos y ficha de equipo, pilotos y ficha de piloto (casco generado, radar de atributos,
  contrato, temporada), calendario, ronda (resultados por sesión, circuito, mundial tras la ronda) y clasificación
  con control para retroceder a cualquier ronda.
- **Español e inglés** con selector; español por defecto.
- **Responsive**: navegación superior en escritorio e inferior en el celular.
- **Motor de clasificaciones** (`src/engine/season/`) puro y con tests: reproduce la clasificación oficial.

## Qué incluye la Fase 2

**Partida rápida** (en el menú, *Carrera*): eliges Gran Premio, equipo, pilotos, estrategia y clima, y diriges la carrera.

- **Simulación** en un Web Worker, determinista: neumáticos con desgaste y acantilado, combustible, batería y
  Overtake Mode, aire sucio, adelantamientos, paradas (con doble parada y tuerca lenta), errores, averías, pinchazos,
  amarilla, VSC y safety car, y lluvia con pronóstico incierto.
- **Mapa 2D** con los 22 coches, sectores, zonas de Overtake Mode, pit lane y coche de seguridad. Rueda o pellizco
  para acercar, arrastrar para mover, doble clic para centrar.
- **Torre de tiempos** (intervalo o diferencia con el líder), **estrategia de todos**, **panel de tus dos pilotos**
  y **dirección de carrera** con los avisos del ingeniero.
- **Órdenes**: boxes con compuesto y alerón, ritmo, motor, energía, defender, órdenes de equipo y estrategia automática.
- **Velocidad** x1 a x16 y pausa. Atajos: espacio para pausar, teclas 1 a 5 para la velocidad.
- **IA rival** con undercut, overcut, reacción al safety car y a la lluvia, sin ver el futuro.

Los demás modos de juego aparecen en el inicio como pendientes, con la fase en la que llegan.

## Estructura

```
data/2026/            calendar.json y results.json (de la API) · teams, drivers, staff (generados)
data/2026/base/       datos curados a mano, con fuente en data/SOURCES.md
data/circuits/        un JSON por circuito
scripts/              update-season · build-circuits · build-ratings
src/data/             esquemas zod y carga validada
src/engine/           simulación pura, sin React ni DOM (race/, ai/, season/)
src/ui/               componentes y pantallas
src/i18n/             es.json y en.json
tests/unit · tests/e2e
src/workers/          worker que ejecuta la carrera
docs/                 RATINGS.md · RULES_2026.md · CALIBRATION.md · DECISIONS.md
```

## Logos, fotos y cascos

El juego no incluye logos, fotos de pilotos ni cascos reales: son marcas y material de terceros. Puedes poner los
tuyos desde la pantalla **Ajustes** (uno a uno o todos a la vez, por nombre de archivo) o copiándolos en
`public/assets/logos/`, `drivers/` y `helmets/`. Si falta alguno se dibuja una versión genérica con los colores del equipo.

## Datos estimados

Nada real está inventado. Lo que no tiene fuente fiable está marcado en los JSON y la interfaz lo muestra con la
etiqueta **EST.** o **GENERADO**. El detalle, en `data/SOURCES.md` y `docs/RATINGS.md`.
