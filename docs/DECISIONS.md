# Decisiones de diseño menores

Decisiones que el documento de diseño no cubría y que no cambian mucho el resultado.
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

## Estética e imágenes (entre la Fase 1 y la 2)

| # | Decisión | Motivo |
|---|---|---|
| 15 | **Titillium Web** sustituye a Saira; fondo carbón y rojo como único acento | Petición de acercar el aspecto al de las retransmisiones. No se usan la tipografía propietaria ni el logo de la F1 |
| 16 | **El juego sigue sin incluir logos, fotos ni cascos reales.** Se añadió ya la pantalla de Ajustes (prevista para la Fase 8) para subirlos, con importación en bloque por nombre de archivo | Son marcas y material con derechos de terceros (§11 del diseño). Sin imagen se dibuja un escudo, un busto anónimo y un casco genéricos |
| 17 | **Dexie** se instala ahora, para las imágenes del jugador | La pantalla de Ajustes las guarda en IndexedDB |
| 18 | **Se mantienen los rótulos en mayúsculas** aunque la pasada de limpieza los desaconseja | Son parte del aire de retransmisión que se pidió |

## Fase 2

| # | Decisión | Motivo |
|---|---|---|
| 19 | **El tiempo por vuelta no sale de la física del trazado.** La curvatura solo reparte el tiempo a lo largo de la vuelta; el total lo fija la vuelta rápida real de cada carrera de 2026 | El trazado público es demasiado tosco para deducir tiempos fiables. Así el mapa es creíble y el ritmo es real |
| 20 | **Paso de 0,2 s en vivo y de 1 s en calibración y tests** | A 0,2 s el mapa va fluido; a 1 s una carrera tarda una décima de segundo en simularse. El resultado depende del paso, así que cada modo usa siempre el mismo |
| 21 | **El tráfico se resuelve entre vecinos en el orden de carrera**, no entre vecinos físicos, salvo con safety car | Un doblado no bloquea al líder (banderas azules implícitas) y el código es mucho más simple. Con safety car sí se ordena por posición física |
| 22 | **Un valor de desgaste por juego de neumáticos**; las cuatro ruedas del panel se derivan con un sesgo fijo por eje | El desgaste por rueda no cambia ninguna decisión del jugador todavía |
| 23 | **La aerodinámica activa no es una orden del jugador** | En 2026 es automática y la usan todos; va incluida en el perfil de velocidad |
| 24 | **No usar dos compuestos en seco cuesta 30 s**, en vez de la descalificación real | Un error de estrategia no debería borrar la carrera entera del jugador |
| 25 | **Estrategia automática por coche** (apagada por defecto) | Llevar dos coches a x16 sin ayuda es difícil; con ella, el ingeniero decide las paradas como haría la IA |
| 26 | **Los archivos del motor se agruparon**: `pace`, `energy`, `overtaking`, `incidents`, `flags`, `pit` y `start` viven en `sim.ts`; `tyres`, `weather`, `strategy` y `track` van aparte | Los sistemas del bucle principal comparten tanto estado que separarlos solo añadía indirección. Los que son funciones puras sí están separados y tienen sus tests |
| 27 | **`docs/CALIBRATION.md` lo genera `npm run calibrate`** (200 simulaciones × 20 GP, unos 25 minutos). En `npm test` va una versión corta: Monza y Sepang, 20 simulaciones | Acordado en el plan de la fase |
| 28 | **El desgaste de siete circuitos se bajó** tras comparar con las paradas reales de OpenF1 (Shanghái, Suzuka, Miami, Madrid, Singapur, Austin y Spa) | Mi estimación inicial daba dos paradas donde en 2026 se fue a una |
| 29 | **Quedan para la Fase 3**: sanciones por límites de pista y pit lane, bandera roja, vuelta de formación y mensajes de radio del jugador. Para la Fase 8: gráficas de diferencias vuelta a vuelta, sonidos y niveles de dificultad | Reparto del §12 |

## Rediseño de la interfaz (rama `ui-rediseno`, 2026-11-16)

Sustituye a las decisiones 14, 15 y 18. La decisión "oscuro, estilo transmisión" del diseño se mantiene.

| # | Decisión | Motivo |
|---|---|---|
| 30 | **Dirección de arte "muro de boxes"**: grafito frío, datos en monoespaciada y titulares en grotesca expandida. Elegida por el jugador entre tres propuestas | La estética anterior se parecía demasiado a un clon de F1TV. La interfaz pasa a ser la estación de trabajo del director de equipo |
| 31 | **Sin color de marca fijo.** El color lo ponen los equipos (`--team`) y el código de cronometraje morado/verde/amarillo, que también forma la marca del juego. El rojo queda solo para alertas | Deja de competir con los rojos de Ferrari y Audi, y cada ficha se tiñe de su equipo |
| 32 | **Archivo (variable, eje de ancho 62–125 %) + JetBrains Mono** desde Google Fonts, en lugar de Titillium Web | Una sola familia hace de titular expandido, texto y rótulo condensado. En pantallas estrechas el titular baja a ancho normal para que quepa |
| 33 | **`--team-ink`**: el color del equipo aclarado cuando se usa como texto | Los azules de Williams y Red Bull no llegan al contraste mínimo sobre el fondo oscuro |
| 34 | **Las mayúsculas se quedan** en titulares y rótulos de instrumento | Son parte del lenguaje de monitor de tiempos; el texto corrido va en minúsculas |
| 35 | **Pulido tras la auditoría de unslop**: sin velo de color en las fichas (el color del equipo queda en la franja, la placa y el dorsal), espaciado en rejilla de 4 px, números sin cero delante, tres niveles de texto y una sola entrada animada por pantalla. El titular de Inicio pasa a «Dirige un equipo real de 2026 desde el muro» | El anterior valía para cualquier juego de gestión. Titulares en peso 800 y rótulos en mayúsculas se mantienen a propósito (decisión 34) |
| 36 | **El juego se llama «Box Box»** (antes «Paddock Manager 2026»), elegido por el jugador. Cambia el título, `app.name` en es/en, el README y el nombre del paquete; la carpeta del proyecto se queda | La llamada de radio para entrar a boxes. Sin el año, porque el juego es multitemporada. No incluye marcas de la F1 ni de la FIA. Sin comprobar aún disponibilidad en tiendas, dominios ni registro de marcas |
