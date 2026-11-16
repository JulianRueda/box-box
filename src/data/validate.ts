import type { Calendar, Circuit, Driver, Results, Staff, Team } from './schemas.ts';

export interface SeasonData {
  teams: Team[];
  drivers: Driver[];
  calendar: Calendar;
  results: Results;
  staff: Staff[];
  circuits: Circuit[];
}

/**
 * Comprueba la integridad referencial entre archivos (lo que zod no ve por separado).
 * Devuelve la lista de problemas; vacía = todo correcto.
 */
export function validateSeason(data: SeasonData): string[] {
  const problems: string[] = [];
  const teamIds = new Set(data.teams.map((t) => t.id));
  const driverIds = new Set(data.drivers.map((d) => d.id));
  const circuitIds = new Set(data.circuits.map((c) => c.id));

  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${label} duplicado: ${id}`);
      seen.add(id);
    }
  };
  unique('equipo', data.teams.map((t) => t.id));
  unique('piloto', data.drivers.map((d) => d.id));
  unique('código de piloto', data.drivers.map((d) => d.code));
  unique('staff', data.staff.map((s) => s.id));

  for (const d of data.drivers) {
    if (d.teamId && !teamIds.has(d.teamId)) problems.push(`piloto ${d.id}: equipo desconocido ${d.teamId}`);
  }
  for (const t of data.teams) {
    const seats = data.drivers.filter((d) => d.teamId === t.id && d.role === 'race').length;
    if (seats !== 2) problems.push(`equipo ${t.id}: ${seats} pilotos titulares (deben ser 2)`);
  }
  for (const s of data.staff) {
    if (!teamIds.has(s.teamId)) problems.push(`staff ${s.id}: equipo desconocido ${s.teamId}`);
    if (s.driverId && !driverIds.has(s.driverId)) problems.push(`staff ${s.id}: piloto desconocido ${s.driverId}`);
  }

  data.calendar.rounds.forEach((r, i) => {
    if (r.round !== i + 1) problems.push(`calendario: la ronda en la posición ${i + 1} tiene número ${r.round}`);
    if (!circuitIds.has(r.circuitId)) problems.push(`ronda ${r.round}: falta el circuito ${r.circuitId}`);
    if (r.sprint !== Boolean(r.sessions.sprint)) problems.push(`ronda ${r.round}: sprint incoherente con las sesiones`);
  });

  for (const rr of data.results.rounds) {
    const round = data.calendar.rounds.find((r) => r.round === rr.round);
    if (!round) {
      problems.push(`resultados: ronda ${rr.round} no está en el calendario`);
      continue;
    }
    if (round.sprint !== (rr.sprint !== null)) problems.push(`ronda ${rr.round}: resultados de sprint incoherentes con el calendario`);
    const sessions = { qualifying: rr.qualifying, sprint: rr.sprint ?? [], race: rr.race };
    for (const [name, entries] of Object.entries(sessions)) {
      const seen = new Set<string>();
      for (const e of entries) {
        if (!driverIds.has(e.driverId)) problems.push(`ronda ${rr.round} ${name}: piloto desconocido ${e.driverId}`);
        if (!teamIds.has(e.teamId)) problems.push(`ronda ${rr.round} ${name}: equipo desconocido ${e.teamId}`);
        if (seen.has(e.driverId)) problems.push(`ronda ${rr.round} ${name}: ${e.driverId} aparece dos veces`);
        seen.add(e.driverId);
      }
    }
  }
  if (data.results.lastRound !== (data.results.rounds.at(-1)?.round ?? 0)) problems.push('resultados: lastRound no coincide con la última ronda');

  return problems;
}
