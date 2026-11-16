# Decisiones de diseño menores

Decisiones que el documento de diseño (`CLAUDE.md`) no cubría y que no cambian mucho el resultado.
Las que sí lo cambian se consultan antes.

## Fase 1

| # | Decisión | Motivo |
|---|---|---|
| 1 | **Tailwind 4 con tokens en CSS** (`@theme` en `src/index.css`), sin `tailwind.config.ts` | Es la forma nativa de Tailwind 4; los tokens quedan en un solo sitio |
| 2 | **HashRouter** (`/#/teams`) | El juego es estático: funciona servido desde cualquier carpeta y como PWA sin redirecciones en el servidor |
| 3 | **Datos base curados + valoraciones generadas.** `data/2026/base/*.base.json` se edita a mano; `teams.json`, `drivers.json` y `staff.json` los escribe `build-ratings` | Separa hechos (con fuente) de números de juego (con fórmula) y permite recalcular tras cada carrera |
| 4 | **`update-season` no escribe sin confirmación**: muestra el diff y pregunta; `--yes` para aplicar sin preguntar | El diseño pide ver el diff antes de escribir |
| 5 | **`update-season` usa solo Jolpica** por ahora. OpenF1 (sesiones, stints, clima) entra en la Fase 2 | En la Fase 1 nada consume stints ni clima; se añade cuando la simulación lo necesite |
| 6 | **`data/2026/feeder/` se aplaza a la Fase 5** | Acordado en el plan de la fase: es donde se usa |
| 7 | **Banderas como código de país** (`IT`, `GB`) y nombre traducido con `Intl.DisplayNames` | Windows no dibuja los emojis de bandera. Banderas en SVG, en la Fase 8 |
| 8 | **Vueltas del circuito = vueltas del ganador real** en las rondas disputadas | Es el dato verificable. Si una carrera se acortó, el número queda por debajo de lo programado: revisar al calibrar (Canadá 68 y Sepang 55 son candidatas) |
| 9 | **El equipo de un piloto en la clasificación es el de su última carrera** hasta esa ronda | Así Lawson aparece con Red Bull tras la ronda 13 y con Racing Bulls al final |
| 10 | **Los JSON guardan la situación actual** (director, reservas, asientos). Los cambios a mitad de año solo se reflejan en los resultados | Para empezar desde una ronda anterior hará falta un historial de cambios; se diseña en la Fase 4 con el modo carrera |
| 11 | **Un solo director técnico por equipo** aunque el real tenga varios | El modelo de staff del diseño tiene un puesto de director técnico |
| 12 | **Sin Dexie, worker ni Canvas todavía** | Se instalan en la fase que los usa (2 y 4) |
| 13 | **Zonas de Overtake Mode = rectas más largas detectadas por geometría** | No hay lista pública consolidada; se sustituye por datos reales si aparecen |
| 14 | **Tipografías Saira / Saira Condensed / JetBrains Mono** desde Google Fonts, con pila de respaldo local | Aire de rótulo de TV sin usar fuentes propietarias; el juego funciona sin red con las de respaldo |
