# Reglamento 2026: qué se confirmó y cómo se modela

Consultado el 15 de noviembre de 2026. Cada punto indica la fuente y cómo entra en la simulación.
Lo que no se pudo confirmar está marcado como **sin confirmar** y se trata como parámetro de juego.

## Confirmado

| Punto | Lo confirmado | Fuente | En el juego |
|---|---|---|---|
| Unidad de potencia | Reparto aproximado 50/50 entre combustión y eléctrico. El MGU-K sube de 120 a 350 kW. Se elimina el MGU-H | [Yahoo Sports](https://sports.yahoo.com/articles/f1-2026-rules-explained-overtake-122850613.html), [boxboxgp](https://boxboxgp.io/strategy/2026-f1-regulations-explained), [factlen](https://factlen.com/news/the-2026-f1-regulations-explained-active-aero-50-50-power-and-the-death-of-drs-00455-2cb08b12) | La batería es un recurso central: estado de carga, recuperación y despliegue por modo (`sim.ts`, `ENERGY_DEPLOY`). Quedarse sin carga cuesta un 0,7 % por vuelta |
| Aerodinámica activa | Alerones móviles delante y detrás, con un modo de baja resistencia en recta y otro de alta carga en curva. Sustituye al DRS | Mismas fuentes; [motorizedfocus](https://www.motorizedfocus.com/formula-1-/f1-2026-active-aero-rules-explained) | Es automática y la usan todos, así que no da ventaja relativa: va incluida en el perfil de velocidad del circuito, no es una orden del jugador |
| Overtake Mode | Energía eléctrica extra para quien rueda a un segundo o menos del coche de delante | [Yahoo Sports](https://sports.yahoo.com/articles/f1-2026-rules-explained-overtake-122850613.html) | Se activa al entrar en una zona si el intervalo es menor de 1,0 s. Da un 3,5 % de velocidad en la zona y gasta un 4,5 % de batería |
| Puntos de carrera | 25-18-15-12-10-8-6-4-2-1 | [Reglamento deportivo FIA, sección B](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_06_-_2026-04-28.pdf) y resultados reales | `src/engine/season/points.ts`; un test comprueba la tabla contra las 20 carreras |
| Puntos de sprint | 8-7-6-5-4-3-2-1, sin punto por vuelta rápida | [SPORTbible](https://www.sportbible.com/f1/fia-announce-rule-changes-sprint-races-formula-1-434167-20251210) y resultados reales | Igual; test contra los 6 sprints |
| Fines de semana sprint | Seis: China, Miami, Canadá, Gran Bretaña, Países Bajos y Singapur | Calendario de Jolpica | `calendar.json` |
| Compuestos | Pirelli lleva cinco compuestos de seco (C1–C5) y elige tres por carrera | [Pirelli](https://press.pirelli.com/complete-f1-tyre-range-for-the-first-three-grands-prix-of-2026/) | `data/2026/tyres.json`. El modelo trabaja con blando, medio y duro; el número C se guarda como dato |

## Discrepancia resuelta con datos

**Punto por vuelta rápida.** Una referencia no oficial del reglamento dice que la vuelta rápida da un punto si se acaba
entre los diez primeros. Los resultados reales lo desmienten: en las 20 carreras disputadas, los puntos de cada piloto
coinciden exactamente con la tabla 25-18-15… sin ningún punto extra (lo comprueba `tests/unit/standings.test.ts`).
El juego **no** da punto por vuelta rápida.

## Sin confirmar (parámetros de juego)

| Punto | Estado | Qué usa el juego |
|---|---|---|
| Dos compuestos de seco obligatorios | Las búsquedas no devolvieron el artículo del reglamento. Es la norma vigente desde hace años | Se aplica: quien termina una carrera seca con un solo compuesto recibe 30 s |
| Peso mínimo y dimensiones | Las fuentes dicen "más pequeños y ligeros", sin cifras | No se modela el peso absoluto; el atributo "peso" del coche es una estimación |
| Energía por vuelta y capacidad de batería | Sin cifras fiables | Batería normalizada de 0 a 1; se recupera alrededor de un 30 % por vuelta |
| Límite de unidades de potencia y sanciones | Una referencia no oficial habla de 4 motores por temporada | Fuera de la Fase 2: entra con el modo carrera (Fase 4 y 6) |
| Límite presupuestario y túnel de viento por posición | No investigado todavía | Fuera de la Fase 2: entra en la Fase 6 |
| Carga de combustible | Sin cifra pública para 2026 | 0,245 kg/km (unos 75 kg para 305 km) y 0,033 s por kilo en una vuelta de 90 s |

## Asignación de neumáticos por GP

Confirmadas con comunicados de Pirelli o análisis que los citan: Australia, China, Japón, Bélgica, Hungría, Países Bajos,
Italia, España (Madrid), Las Vegas, Catar y Abu Dabi
([primeras tres carreras](https://press.pirelli.com/complete-f1-tyre-range-for-the-first-three-grands-prix-of-2026/),
[Zandvoort, Monza y Madrid](https://press.pirelli.com/tyre-compounds-selected-for-zandvoort-monza-and-madrid/),
[últimas tres](https://press.pirelli.com/tyre-compounds-selected-for-the-final-three-races-of-the-season/),
[Bélgica y Hungría](https://blog.f1livepulse.com/pirelli-tyre-nominations-analysed-belgium-hungary-2026)).

Las otras doce van con `"estimated": true` en `tyres.json`: son la gama que se esperaría por el tipo de circuito.
