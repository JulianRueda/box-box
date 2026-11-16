/**
 * Carga de los JSON de la temporada. Todo pasa por zod al importarse:
 * si un archivo no cumple el esquema, la app falla al arrancar con un error claro
 * en vez de mostrar datos corruptos.
 */
import { z } from 'zod';
import calendarJson from '../../data/2026/calendar.json';
import driversJson from '../../data/2026/drivers.json';
import resultsJson from '../../data/2026/results.json';
import staffJson from '../../data/2026/staff.json';
import teamsJson from '../../data/2026/teams.json';
import {
  calendarSchema,
  circuitSchema,
  driverSchema,
  resultsSchema,
  staffSchema,
  teamSchema,
  type Circuit,
  type Driver,
  type Round,
  type RoundResult,
  type Team,
} from './schemas.ts';

const circuitModules = import.meta.glob<{ default: unknown }>('../../data/circuits/*.json', { eager: true });

export const SEASON = 2026;
export const teams = z.array(teamSchema).parse(teamsJson);
export const drivers = z.array(driverSchema).parse(driversJson);
export const calendar = calendarSchema.parse(calendarJson);
export const results = resultsSchema.parse(resultsJson);
export const staff = z.array(staffSchema).parse(staffJson);
export const circuits = Object.values(circuitModules).map((m) => circuitSchema.parse(m.default));

const teamIndex = new Map(teams.map((t) => [t.id, t]));
const driverIndex = new Map(drivers.map((d) => [d.id, d]));
const circuitIndex = new Map(circuits.map((c) => [c.id, c]));
const resultIndex = new Map(results.rounds.map((r) => [r.round, r]));

export const findTeam = (id: string): Team | undefined => teamIndex.get(id);
export const findDriver = (id: string): Driver | undefined => driverIndex.get(id);
export const findCircuit = (id: string): Circuit | undefined => circuitIndex.get(id);
export const findRound = (round: number): Round | undefined => calendar.rounds.find((r) => r.round === round);
export const findResult = (round: number): RoundResult | undefined => resultIndex.get(round);

export const raceDrivers = (teamId: string): Driver[] => drivers.filter((d) => d.teamId === teamId && d.role === 'race');
export const reserveDrivers = (teamId: string): Driver[] => drivers.filter((d) => d.teamId === teamId && d.role !== 'race');
export const teamStaff = (teamId: string) => staff.filter((s) => s.teamId === teamId);

export const driverName = (d: Driver): string => `${d.givenName} ${d.familyName}`;

/** Media de las valoraciones de rendimiento del coche (0–100). */
export function carOverall(team: Team): number {
  const c = team.car;
  return Math.round((c.downforceHigh + c.downforceMedium + c.downforceLow + c.straightEfficiency + c.enginePower + c.energyDeployment) / 6);
}

/** Media de los atributos de pilotaje (0–100). */
export function driverOverall(d: Driver): number {
  const a = d.attributes;
  return Math.round((a.qualifyingPace + a.racePace + a.tyreManagement + a.overtaking + a.defending + a.consistency) / 6);
}

export function ageOn(dateOfBirth: string, on: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const before = on.getUTCMonth() < dob.getUTCMonth() || (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  if (before) age--;
  return age;
}

export type { Circuit, Driver, Round, RoundResult, Team };
