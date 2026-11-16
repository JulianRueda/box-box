# Fuentes de los datos

Consultadas el **15 de noviembre de 2026**, con la temporada en la ronda 20 de 23.
Regla del proyecto: ningún dato real se inventa. Lo que no tiene fuente fiable va marcado
(`estimated`, `endYearEstimated`, `unverifiedFields`, `generated`, `estimatedFields`) y la interfaz lo señala.

## Calendario y resultados — `2026/calendar.json`, `2026/results.json`

| Dato | Fuente |
|---|---|
| Rondas, fechas, horarios de sesión, fines de semana sprint | API de Jolpica (sucesora de Ergast): `https://api.jolpi.ca/ergast/f1/2026/races/` |
| Resultados de carrera, clasificación y sprint | Jolpica: `/2026/{ronda}/results/`, `/qualifying/`, `/sprint/` |
| Clasificación oficial usada para verificar el motor (tests) | Jolpica: `/2026/driverstandings/`, `/2026/constructorstandings/` |

Se regeneran con `npm run update-season`. No se editan a mano.

Notas:
- El calendario tiene 23 rondas. El GP de Arabia Saudí se canceló y el de Baréin se aplazó y se trasladó a Sepang
  ("Bahrain Grand Prix in Malaysia", ronda 16). Fuentes: [Wikipedia, temporada 2026](https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship),
  [Sky Sports](https://www.skysports.com/f1/news/13519453/f1-confirms-cancellation-of-bahrain-and-saudi-arabian-grands-prix-due-to-war-in-middle-east-as-2026-calendar-reduced-to-22-races),
  [ABC News](https://www.abc.net.au/news/2026-03-15/f1-cancels-bahrain-and-saudi-arabia-grand-prix-middle-east-war/106455116).
- Jolpica no publica los resultados de la clasificación sprint ni el clima de cada sesión: no están en el repo.
- En clasificación, quien no marca tiempo no aparece (por eso alguna ronda tiene menos de 22 filas).

## Equipos — `2026/base/teams.base.json`

| Campo | Fuente | Estado |
|---|---|---|
| Nombre oficial, chasis, unidad de potencia | Tabla de inscritos de [Wikipedia, temporada 2026](https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship) | Confirmado (la fila de Red Bull Racing no se pudo leer literal; coincide con Jolpica y la lista de la FIA publicada por [The Race](https://www.the-race.com/formula-1/f1-2026-entry-list-driver-numbers-chassis-engines/)) |
| Director | [GPblog](https://www.gpblog.com/en/features/meet-the-11-formula-1-team-principals-set-for-the-2026-season), [lista del Indianapolis Motor Speedway](https://www.indymotorspeedway.com/26_F1_team.html) | Confirmado, con dos cambios durante el año (abajo) |
| Sede | Artículos de cada constructor en Wikipedia (enlazados desde Jolpica) | Confirmado |
| Colores | Colores de equipo de uso habitual en grafismos de TV | **Aproximados**: no hay hex oficiales publicados |
| Presupuesto | — | **Estimado** (`budgetM.estimated`) |

Cambios de director en 2026:
- **Audi**: Jonathan Wheatley salió el 20-03-2026; Mattia Binotto es CEO y director desde entonces. [Nota de prensa de Audi](https://www.audi.com/en/press-releases/audi-centralizes-responsibilities-in-formula-1-project-16624), [Wikipedia: Mattia Binotto](https://en.wikipedia.org/wiki/Mattia_Binotto).
- **Cadillac**: Marcin Budkowski sustituyó a Graeme Lowdon el 12-08-2026. [Wikipedia: Cadillac in Formula One](https://en.wikipedia.org/wiki/Cadillac_in_Formula_One), [Wikipedia: Graeme Lowdon](https://en.wikipedia.org/wiki/Graeme_Lowdon).
- **Alpine**: no hay director con ese título; el cargo está repartido entre Flavio Briatore y Steve Nielsen (GPblog).

El JSON guarda el director **actual**. Si empiezas una partida desde una ronda anterior al cambio, de momento verás al actual (ver `docs/DECISIONS.md`).

## Pilotos — `2026/base/drivers.base.json`

| Campo | Fuente | Estado |
|---|---|---|
| Nombre, número, fecha de nacimiento, nacionalidad de quien ha corrido en F1 | Jolpica (`/drivers/`) | Confirmado |
| Participaciones antes de 2026 | Jolpica: total de resultados del piloto menos los de 2026 | Confirmado (cuenta inscripciones con resultado, incluidos "no salió") |
| Quién corrió qué ronda y con qué equipo | `results.json` | Confirmado |
| Fin de contrato | [PlanetF1, 28-10-2026](https://www.planetf1.com/news/f1-2026-driver-contract-statuses) | Confirmado salvo los marcados |
| Salario | [RacingNews365](https://racingnews365.com/f1-drivers-salaries-2026) | Cifras periodísticas, no oficiales |
| Reservas y pilotos de pruebas | [formula1.com, 25-02-2026](https://www.formula1.com/en/latest/article/who-are-the-reserve-drivers-for-each-f1-team-in-2026.Ce8YvwuVJGLkVNgERX21U) | Confirmado salvo los marcados |

Cambios de asiento durante la temporada (todos salen de `results.json`):
- Rondas 12–14: Liam Lawson corrió con Red Bull en lugar de Isack Hadjar, y Yuki Tsunoda ocupó su sitio en Racing Bulls.
- Ronda 19: Ryo Hirakawa sustituyó a Esteban Ocon en Haas. Ronda 20: lo hizo Rafael Câmara. Haas anunció que Ocon no vuelve esta temporada
  ([FanBuzz](https://fanbuzz.com/racing/formula-1/f1-team-makes-surprise-midseason-driver-change-esteban-ocon-haas/)).

Marcados como no confirmados:
- `contract.endYearEstimated`: Hamilton (PlanetF1 se contradice entre 2026 y 2027), Leclerc, Piastri y Stroll (fin no público), y todos los reservas.
- `contract.salaryM.estimated`: todos los reservas y pilotos de pruebas (no hay cifras publicadas).
- `unverifiedFields: ["dateOfBirth"]`: Fornaroli (las fuentes dan fechas distintas), O'Ward e Iwasa (no se encontró fuente en la búsqueda).
- `unverifiedFields: ["role"]`: Doohan, Zhou, Hirakawa y Câmara (formula1.com los vincula al equipo sin dar un título).
- Los salarios de Colapinto y Lindblad aparecen como rango (0,5–1 M$); se guarda el punto medio.

## Personal — `2026/base/staff.base.json`

| Puesto | Fuente | Estado |
|---|---|---|
| Ingenieros de pista (22) | [Motorsport.com, 22-03-2026](https://au.motorsport.com/f1/news/every-race-engineer-f1-2026/10807005/) | Confirmado a marzo. El de Hamilton (Carlo Santi) figuraba como provisional |
| Directores técnicos (10 de 11) y jefes de aerodinámica (3 de 11) | [Lista del Indianapolis Motor Speedway](https://www.indymotorspeedway.com/26_F1_team.html) | Confirmado |
| Resto: director técnico de Aston Martin, 8 jefes de aerodinámica y todos los jefes de estrategia, de mecánicos y de academia | — | **Generados** (`generated: true`): nombres inventados por `build-ratings.ts` |

En equipos con varios directores técnicos se guarda uno: el de chasis (Ferrari, Audi) o el de ingeniería (McLaren).

## Circuitos — `circuits/*.json`

| Campo | Fuente | Estado |
|---|---|---|
| Trazado y longitud | GeoJSON de [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (licencia MIT) | Confirmado |
| Vueltas | Vueltas del ganador en `results.json` | Confirmado en rondas disputadas; programado (y marcado) en las 3 restantes |
| Punto de salida del trazado, sectores, zonas de Overtake Mode, boxes | — | **Estimado**. Las zonas son las rectas más largas detectadas por geometría |
| Carga aerodinámica, desgaste, dificultad de adelantamiento, safety car, lluvia | `scripts/circuit-meta.ts` | **Estimado** a mano; se calibrará en la Fase 2 |

Se regeneran con `npm run build-circuits`.

## Valoraciones — `2026/teams.json`, `2026/drivers.json`, `2026/staff.json`

No son datos reales: las calcula `npm run build-ratings` a partir de los resultados. Fórmula en `docs/RATINGS.md`.

## Referencias de carrera — `2026/race-facts.json`

| Dato | Fuente |
|---|---|
| Pole, vuelta rápida y tiempo del ganador | `results.json` (Jolpica) |
| Paradas medias, duración de los stints, compuesto de salida y si hubo neumáticos de agua | API de OpenF1: `https://api.openf1.org/v1/sessions` y `/stints` |

Se regenera con `npm run update-race-facts`. Se usa para calibrar la simulación (`docs/CALIBRATION.md`).

Notas:
- "Mojado" significa que algún coche montó intermedios o lluvia. Fue el caso de Canadá, Sepang y Brasil.
- Las paradas medias cuentan solo a quien llegó (casi) al final e incluyen las provocadas por safety car, lluvia o daños.
- Mónaco registra 5 paradas de media: apunta a una norma de paradas obligatorias propia de esa carrera, que no se ha investigado.

## Neumáticos — `2026/tyres.json`

Once asignaciones confirmadas con comunicados de Pirelli y doce estimadas (`"estimated": true`). El detalle y los enlaces, en `docs/RULES_2026.md`.

## Reglamento

Lo confirmado y lo que queda sin confirmar, con sus fuentes, está en `docs/RULES_2026.md`.
