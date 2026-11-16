# Valoraciones de juego

Los atributos (0–100) no existen oficialmente. Los calcula `scripts/build-ratings.ts` con los resultados reales
de 2026 y los datos base de `data/2026/base/`. Mismo input, mismo output: no hay números puestos a mano.

```
npm run update-season   # trae resultados nuevos
npm run build-ratings   # recalcula teams.json, drivers.json y staff.json
```

## Coches

Base: **diferencia porcentual con el mejor tiempo**, por ronda.

- `gapQ` = mejor tiempo del equipo en clasificación (Q1, Q2 o Q3) frente a la pole.
- `gapR` = mejor vuelta rápida del equipo en carrera frente a la mejor de la carrera.
- `ritmo(gap) = clamp(99 − 11·gap, 35, 99)`: 0 % → 99, 1 % → 88, 3 % → 66.

Se toma la **mediana** entre rondas para que un mal sábado no hunda la nota.

| Atributo | Fórmula |
|---|---|
| Carga alta / media / baja | `ritmo(mediana gapQ)` solo en circuitos de ese nivel de carga (`downforceLevel` de cada circuito) |
| Potencia del motor | Por motorista: `0,6·máx + 0,4·media` de la nota de carga baja de sus equipos |
| Eficiencia en recta | `0,5·cargaBaja + 0,5·potencia + 0,5·(cargaBaja − cargaAlta)` |
| Despliegue de energía | `0,5·potencia + 0,5·ritmo(mediana gapR)` |
| Fiabilidad | `100 − 160·(no clasificados / participaciones)`, entre 40 y 99 |
| Cuidado de neumáticos | `68 + 4·media(ganancia corregida)` de los coches clasificados |
| Peso | `50 + 0,5·(nivel general − 50)`. **Estimado**: no hay datos públicos de peso |

`ganancia corregida = parrilla − meta − 0,3·(parrilla − 11,5)`. Quien sale delante no puede ganar puestos y quien sale
detrás los gana solo por abandonos ajenos; el segundo término descuenta esa regresión a la media.

## Pilotos

Solo para quien ha corrido **5 o más carreras** en 2026. El problema de fondo es separar piloto y coche, y la única
referencia limpia es el compañero de equipo:

- `q` = media de la diferencia porcentual con el compañero en clasificación, en la última sesión en la que ambos
  marcaron tiempo (recortada a ±1,5 %). Negativo = más rápido.
- `h` = fracción de carreras en las que terminó delante del compañero (solo cuando ambos se clasificaron).
- `prior = 0,3·(nivel del coche − 75)`. Sin él, el más rápido de cada pareja tendría la misma nota en Mercedes que en
  Cadillac. Se asume que los equipos de arriba fichan mejores pilotos.

| Atributo | Fórmula |
|---|---|
| Ritmo a una vuelta | `82 − 14·q + prior` |
| Ritmo de carrera | `82 + 14·(h − 0,5) − 5·q + prior` |
| Gestión de neumáticos | `78 + 2,5·(ganancia corregida propia − la del compañero)` |
| Adelantamiento | `74 + 3,5·ganancia corregida media` |
| Defensa | `58 + 38·(carreras sin perder puestos respecto a la parrilla / carreras clasificado)` |
| Consistencia | `96 − 70·tasa de abandonos − 1,5·desviación típica de la posición final` |
| Experiencia | `30 + 68·(1 − e^(−participaciones/110))`, con las participaciones en GP de toda su carrera |
| Feedback técnico | `45 + 0,5·experiencia` |
| Lluvia | `0,5·carrera + 0,3·una vuelta + 0,2·experiencia`. **Derivado** |
| Gestión de energía | `0,5·carrera + 0,25·consistencia + 0,25·experiencia`. **Derivado** |
| Carisma | `45 + 0,25·experiencia + 1,5·victorias + 0,5·podios + 0,03·puntos`. **Derivado** |
| Moral | `65 + 24·(h − 0,5) + 10·(parte de los puntos del equipo − 0,5)` |
| Potencial (≤ 25 años) | `media de pilotaje + 1,8·(26 − edad)` |

Todo se recorta a 40–99 (experiencia desde 30) y se redondea.

**Pilotos con menos de 5 carreras en 2026** (reservas, Tsunoda, Hirakawa, Câmara): no hay muestra. Reciben un nivel
base `66 + 10·(1 − e^(−participaciones/60))` en todos los atributos de pilotaje y `attributesEstimated: true`.

## Staff

- Nivel del equipo: `55 + 0,42·nivel general del coche`.
- Director técnico y jefe de aerodinámica reales: el nivel del equipo.
- Ingeniero de pista: media entre el nivel del equipo y el ritmo de carrera de su piloto.
- Personal generado: nivel del equipo ± 6 con un generador determinista sembrado con `equipo:puesto`.

## Limitaciones conocidas

1. **Lluvia, energía y carisma no se miden.** Jolpica no da el clima de cada sesión ni datos de batería. Están marcados
   como estimados en la ficha. OpenF1 podría aportar clima y stints (pendiente para la Fase 2).
2. **Comparar con el compañero no ordena la parrilla entera.** Dos compañeros igual de buenos o igual de malos salen
   parecidos; el `prior` del coche lo corrige solo en parte.
3. **La evolución de la pista sesga los coches lentos.** Un equipo eliminado en Q1 no llega a la pista más rápida de
   Q3, así que su diferencia con la pole queda algo inflada.
4. **Fiabilidad incluye accidentes.** Jolpica solo dice "Retired", sin causa.
5. **El nivel de carga de cada circuito es una clasificación manual**, y de ella dependen las tres notas de carga.

Estas notas son el punto de partida. La Fase 2 las recalibra contra tiempos por vuelta reales (§5.4 del diseño).

## Cómo usa la carrera estas notas (Fase 2)

- **Coche**: su diferencia de ritmo en un circuito es la inversa de la fórmula de arriba, `(99 − nota) / 11` en porcentaje,
  mezclando un 75 % de la nota de carga que pide el circuito y un 25 % del despliegue de energía. En carrera se multiplica
  por 0,85: las diferencias entre coches son algo menores que a una vuelta.
- **Piloto**: cada 14 puntos de ritmo de carrera equivalen a un 0,55 % de tiempo por vuelta.
- **Consistencia** fija el ruido vuelta a vuelta y la probabilidad de error; **adelantamiento** y **defensa** entran en
  cada intento de pasada; **gestión de neumáticos** y **cuidado de neumáticos** del coche alargan la vida de la goma;
  **gestión de energía** aumenta lo que se recupera por vuelta; **fiabilidad** fija la probabilidad de avería.
- **Jefe de mecánicos** fija el tiempo de parada; **jefe de estrategia**, lo fino que elige el plan y lo pronto que
  reacciona a la lluvia.

La calibración (`docs/CALIBRATION.md`) confirmó el orden de la parrilla sin retocar ninguna nota a mano.
