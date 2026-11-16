import { z } from 'zod';

/** Valoración de juego 0–100. */
const rating = z.number().min(0).max(100);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
const id = z.string().regex(/^[a-z0-9_]+$/);

/** Valor numérico con marca de si es un dato público o una estimación. */
const estimatedNumber = z.object({
  value: z.number(),
  estimated: z.boolean(),
});

// ---------------------------------------------------------------- Equipos

export const carRatingsSchema = z.object({
  downforceHigh: rating,
  downforceMedium: rating,
  downforceLow: rating,
  straightEfficiency: rating,
  enginePower: rating,
  energyDeployment: rating,
  reliability: rating,
  tyreWear: rating,
  weight: rating,
});

export const teamSchema = z.object({
  id,
  name: z.string(),
  fullName: z.string(),
  shortName: z.string().max(4),
  chassis: z.string(),
  powerUnit: z.string(),
  base: z.string(),
  baseCountryCode: z.string().length(2),
  countryCode: z.string().length(2),
  principal: z.string(),
  colors: z.object({ primary: hex, secondary: hex }),
  /** Presupuesto anual en millones de USD. */
  budgetM: estimatedNumber,
  car: carRatingsSchema,
});

// ---------------------------------------------------------------- Pilotos

export const driverAttributesSchema = z.object({
  qualifyingPace: rating,
  racePace: rating,
  tyreManagement: rating,
  overtaking: rating,
  defending: rating,
  wetWeather: rating,
  consistency: rating,
  energyManagement: rating,
  technicalFeedback: rating,
  experience: rating,
  marketability: rating,
  morale: rating,
  /** Solo pilotos jóvenes (≤ 25 años). */
  potential: rating.optional(),
});

export const driverRoleSchema = z.enum(['race', 'reserve', 'test']);

export const driverSchema = z.object({
  id,
  code: z.string().length(3),
  number: z.number().int().min(0).max(99).nullable(),
  givenName: z.string(),
  familyName: z.string(),
  /** ISO 3166-1 alpha-2. */
  countryCode: z.string().length(2),
  dateOfBirth: isoDate,
  teamId: id.nullable(),
  role: driverRoleSchema,
  contract: z.object({
    endYear: z.number().int(),
    endYearEstimated: z.boolean(),
    /** Salario anual en millones de USD. */
    salaryM: estimatedNumber,
  }),
  /** Participaciones en GP con resultado en Jolpica antes de 2026 (base de la experiencia). */
  careerStartsBefore2026: z.number().int().min(0),
  /** Campos de datos reales que no se pudieron confirmar con una fuente fiable. */
  unverifiedFields: z.array(z.string()),
  attributes: driverAttributesSchema,
  /** true si los atributos no salen de resultados de 2026 (reservas sin carreras). */
  attributesEstimated: z.boolean(),
});

// ---------------------------------------------------------------- Calendario

export const roundSchema = z.object({
  round: z.number().int().min(1),
  name: z.string(),
  circuitId: id,
  circuitName: z.string(),
  locality: z.string(),
  country: z.string(),
  date: isoDate,
  sprint: z.boolean(),
  sessions: z.object({
    fp1: isoDateTime.optional(),
    fp2: isoDateTime.optional(),
    fp3: isoDateTime.optional(),
    sprintQualifying: isoDateTime.optional(),
    sprint: isoDateTime.optional(),
    qualifying: isoDateTime.optional(),
    race: isoDateTime,
  }),
});

export const calendarSchema = z.object({
  season: z.number().int(),
  rounds: z.array(roundSchema),
});

// ---------------------------------------------------------------- Resultados

export const qualifyingEntrySchema = z.object({
  position: z.number().int().min(1),
  driverId: id,
  teamId: id,
  q1: z.string().nullable(),
  q2: z.string().nullable(),
  q3: z.string().nullable(),
});

export const raceEntrySchema = z.object({
  position: z.number().int().min(1),
  /** "1", "R" (retirado), "D" (descalificado), "W" (no salió)… como en Ergast. */
  positionText: z.string(),
  driverId: id,
  teamId: id,
  grid: z.number().int().min(0),
  laps: z.number().int().min(0),
  status: z.string(),
  points: z.number().min(0),
  time: z.string().nullable(),
  fastestLap: z
    .object({
      rank: z.number().int().nullable(),
      lap: z.number().int().nullable(),
      time: z.string(),
    })
    .nullable(),
});

export const roundResultSchema = z.object({
  round: z.number().int().min(1),
  qualifying: z.array(qualifyingEntrySchema),
  sprint: z.array(raceEntrySchema).nullable(),
  race: z.array(raceEntrySchema),
});

export const resultsSchema = z.object({
  season: z.number().int(),
  /** Última ronda con carrera disputada. */
  lastRound: z.number().int().min(0),
  rounds: z.array(roundResultSchema),
});

// ---------------------------------------------------------------- Staff

export const staffRoleSchema = z.enum([
  'technicalDirector',
  'headOfAero',
  'headOfStrategy',
  'raceEngineer',
  'chiefMechanic',
  'headOfAcademy',
]);

export const staffSchema = z.object({
  id,
  name: z.string(),
  teamId: id,
  role: staffRoleSchema,
  /** Para ingenieros de pista: piloto con el que trabaja. */
  driverId: id.optional(),
  rating,
  /** true = persona inventada porque el puesto real no es público. */
  generated: z.boolean(),
});

// ---------------------------------------------------------------- Circuitos

const point = z.tuple([z.number(), z.number()]);
const fraction = z.number().min(0).max(1);

export const circuitSchema = z.object({
  id,
  name: z.string(),
  lengthKm: z.number().positive(),
  laps: z.number().int().positive(),
  /** Polilínea cerrada normalizada a [0,1]×[0,1], en sentido de marcha. */
  track: z.array(point).min(20),
  /** Fin de S1 y S2 como fracción de la vuelta (S3 termina en 1). */
  sectors: z.tuple([fraction, fraction]),
  /** Zonas de Overtake Mode como fracciones de vuelta [inicio, fin]; si inicio > fin, cruza la meta. */
  overtakeZones: z.array(z.tuple([fraction, fraction])),
  pit: z.object({
    entry: fraction,
    exit: fraction,
    /** Segundos perdidos por pasar por boxes, sin contar la parada. */
    timeLossS: z.number().positive(),
  }),
  downforceLevel: z.enum(['low', 'medium', 'high']),
  tyreWear: rating,
  overtakingDifficulty: rating,
  safetyCarProbability: fraction,
  /** Probabilidad de lluvia en carrera para el mes en que se corre. */
  rainProbability: fraction,
  /** Campos de este objeto que son estimaciones y no datos medidos. */
  estimatedFields: z.array(z.string()),
});

// ---------------------------------------------------------------- Tipos

export type CarRatings = z.infer<typeof carRatingsSchema>;
export type Team = z.infer<typeof teamSchema>;
export type DriverAttributes = z.infer<typeof driverAttributesSchema>;
export type Driver = z.infer<typeof driverSchema>;
export type Round = z.infer<typeof roundSchema>;
export type Calendar = z.infer<typeof calendarSchema>;
export type QualifyingEntry = z.infer<typeof qualifyingEntrySchema>;
export type RaceEntry = z.infer<typeof raceEntrySchema>;
export type RoundResult = z.infer<typeof roundResultSchema>;
export type Results = z.infer<typeof resultsSchema>;
export type Staff = z.infer<typeof staffSchema>;
export type StaffRole = z.infer<typeof staffRoleSchema>;
export type Circuit = z.infer<typeof circuitSchema>;
