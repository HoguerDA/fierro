import { SEQUENCE, SESSIONS, BLOCK_WEEKS, SESSIONS_PER_WEEK, REENTRY_DAYS, slug } from '../data/routine.js';
import { daysBetween, todayKey, roundToPlate, toUnit, fromUnit } from '../util.js';

// plan = { seqIndex, blockSessions, blockNumber }
export function defaultPlan() { return { seqIndex: 0, blockSessions: 0, blockNumber: 1 }; }

export function currentWeek(plan) {
  return Math.min(BLOCK_WEEKS, Math.floor(plan.blockSessions / SESSIONS_PER_WEEK) + 1);
}
export function isDeload(plan) { return currentWeek(plan) === BLOCK_WEEKS; }

export function nextSessionTemplate(plan) { return SESSIONS[SEQUENCE[plan.seqIndex % SEQUENCE.length]]; }

export function advancePlan(plan) {
  const p = { ...plan };
  p.seqIndex = (p.seqIndex + 1) % SEQUENCE.length;
  p.blockSessions += 1;
  if (p.blockSessions >= BLOCK_WEEKS * SESSIONS_PER_WEEK) { p.blockSessions = 0; p.blockNumber += 1; }
  return p;
}

export function lastSessionDate(sessions) {
  const done = sessions.filter((s) => s.estado === 'terminada');
  if (!done.length) return null;
  return done.map((s) => s.fecha).sort().pop();
}

export function isReentry(sessions) {
  const last = lastSessionDate(sessions);
  return last ? daysBetween(last, todayKey()) > REENTRY_DAYS : false;
}

// Series que tocan hoy para un ejercicio según la semana del bloque.
export function setsFor(ej, week, reentry) {
  if (reentry) return Math.max(2, ej.series - 1);
  if (week === BLOCK_WEEKS) return Math.max(2, Math.ceil(ej.series / 2));
  let s = ej.series;
  if (week >= 3 && ej.clave) s += 1;
  if (week >= 4) s += 1;
  return s;
}

export function rirFor(ej, week, reentry) {
  if (reentry) return 3;
  if (week === BLOCK_WEEKS) return 4;
  return ej.rir;
}

// Historial de un ejercicio (por nombre real usado): últimas sesiones terminadas con series válidas.
export function history(sessions, nombre) {
  const id = slug(nombre);
  const out = [];
  for (const s of sessions.filter((x) => x.estado === 'terminada').sort((a, b) => a.fecha < b.fecha ? 1 : -1)) {
    for (const e of s.ejercicios) {
      if (e.id !== id) continue;
      const sets = e.series.filter((st) => st.hecha && st.peso != null && st.reps != null);
      if (sets.length) out.push({ fecha: s.fecha, sets, deload: s.deload, reentry: s.reentry });
    }
  }
  return out;
}

export function e1rm(peso, reps) { return reps >= 1 ? peso * (1 + reps / 30) : 0; }

export function bestE1rm(sets) { return Math.max(0, ...sets.map((s) => e1rm(s.peso, s.reps))); }

// Sugerencia de peso para hoy (doble progresión).
// Devuelve { peso (kg), motivo, tendencia: 'sube'|'igual'|'baja'|'nuevo' }
export function suggest(ej, sessions, startingWeights, unit, week, reentry) {
  const hist = history(sessions, ej.nombre).filter((h) => !h.deload);
  const inc = fromUnit(unit === 'lb' ? (ej.tipo === 'inferior' ? 10 : 5) : (ej.tipo === 'inferior' ? 5 : 2.5), unit);
  const [lo, hi] = ej.reps;

  if (!hist.length) {
    const start = startingWeights && startingWeights[ej.id];
    if (start != null) return { peso: start, motivo: 'Tu peso inicial. Ajusta si hoy se siente distinto.', tendencia: 'nuevo' };
    return { peso: null, motivo: 'Primera vez: elige un peso con el que llegues a las reps con el RIR indicado.', tendencia: 'nuevo' };
  }

  const last = hist[0];
  const lastPeso = Math.max(...last.sets.map((s) => s.peso));
  const top = last.sets.every((s) => s.reps >= hi && (s.rir == null || s.rir <= ej.rir));
  const below = last.sets.some((s) => s.reps < lo);

  if (reentry) {
    return { peso: fit(lastPeso * 0.85, unit), motivo: 'Sesión de regreso: 85 % de tu último peso para volver sin lastimarte.', tendencia: 'baja' };
  }
  if (week === BLOCK_WEEKS) {
    return { peso: fit(lastPeso * 0.9, unit), motivo: 'Descarga: 90 % del peso, mitad de series, RIR 4.', tendencia: 'baja' };
  }
  if (top) {
    return { peso: fit(lastPeso + inc, unit), motivo: `Llegaste a ${hi} reps en todas las series: sube.`, tendencia: 'sube' };
  }
  if (below) {
    const prev = hist[1];
    const stuck = prev && Math.max(...prev.sets.map((s) => s.peso)) === lastPeso && prev.sets.some((s) => s.reps < lo);
    if (stuck) return { peso: fit(lastPeso - inc, unit), motivo: `Dos sesiones por debajo de ${lo} reps: baja un escalón y vuelve a subir.`, tendencia: 'baja' };
    return { peso: lastPeso, motivo: `Alguna serie quedó bajo ${lo} reps. Mismo peso, busca entrar al rango.`, tendencia: 'igual' };
  }
  return { peso: lastPeso, motivo: `Mismo peso. Meta: ${hi} reps en todas las series para subir la próxima.`, tendencia: 'igual' };
}

function fit(kg, unit) { return fromUnit(roundToPlate(toUnit(kg, unit), unit), unit); }

// Construye la sesión de hoy a partir de la plantilla, el plan y el historial.
export function buildSession(template, plan, sessions, startingWeights, unit) {
  const week = currentWeek(plan);
  const reentry = isReentry(sessions);
  const deload = !reentry && week === BLOCK_WEEKS;
  return {
    id: `${todayKey()}_${template.id}_${Date.now().toString(36)}`,
    fecha: todayKey(),
    inicio: Date.now(),
    fin: null,
    estado: 'activa',
    plantilla: template.id,
    nombre: template.nombre,
    enfasis: template.enfasis,
    bloque: plan.blockNumber,
    semana: week,
    deload,
    reentry,
    ejercicios: template.ejercicios.map((ej) => {
      const sug = suggest(ej, sessions, startingWeights, unit, week, reentry);
      const n = setsFor(ej, week, reentry);
      const rir = rirFor(ej, week, reentry);
      const prev = history(sessions, ej.nombre)[0] || null;
      return {
        id: ej.id, nombre: ej.nombre, original: ej.nombre, musculo: ej.musculo, tipo: ej.tipo,
        reps: ej.reps, rir, descanso: ej.descanso, nota: ej.nota, sustitutos: ej.sustitutos, unilateral: ej.unilateral,
        sugerencia: sug,
        previo: prev ? prev.sets.map((s) => ({ peso: s.peso, reps: s.reps, rir: s.rir })) : null,
        series: Array.from({ length: n }, () => ({ peso: sug.peso, reps: null, rir: null, hecha: false })),
      };
    }),
  };
}

// Sustituye un ejercicio dentro de una sesión activa por uno de sus alternativos.
export function substitute(session, index, nombre, sessions, startingWeights, unit) {
  const e = session.ejercicios[index];
  const fake = { id: slug(nombre), nombre, reps: e.reps, rir: e.rir, tipo: e.tipo };
  const sug = suggest(fake, sessions, startingWeights, unit, session.semana, session.reentry);
  const prev = history(sessions, nombre)[0] || null;
  const copy = { ...session, ejercicios: session.ejercicios.slice() };
  copy.ejercicios[index] = {
    ...e, id: fake.id, nombre, sugerencia: sug,
    previo: prev ? prev.sets.map((s) => ({ peso: s.peso, reps: s.reps, rir: s.rir })) : null,
    series: e.series.map((s) => ({ ...s, peso: s.hecha ? s.peso : sug.peso })),
  };
  return copy;
}

// Resumen de una sesión terminada
export function summary(session, sessions) {
  let series = 0, tonelaje = 0; const prs = [];
  for (const e of session.ejercicios) {
    const done = e.series.filter((s) => s.hecha && s.peso != null && s.reps != null);
    series += done.length;
    tonelaje += done.reduce((a, s) => a + s.peso * s.reps, 0);
    const best = bestE1rm(done);
    const prevBest = Math.max(0, ...history(sessions.filter((s) => s.id !== session.id), e.nombre).map((h) => bestE1rm(h.sets)));
    if (best > 0 && best > prevBest && prevBest > 0) prs.push(e.nombre);
  }
  const min = session.fin && session.inicio ? Math.round((session.fin - session.inicio) / 60000) : null;
  return { series, tonelaje, prs, min };
}

// Series por músculo en los últimos 7 días (sesiones terminadas)
export function weeklyVolume(sessions) {
  const since = todayKey(new Date(Date.now() - 6 * 86400000));
  const vol = {};
  for (const s of sessions) {
    if (s.estado !== 'terminada' || s.fecha < since) continue;
    for (const e of s.ejercicios) {
      const n = e.series.filter((x) => x.hecha).length;
      vol[e.musculo] = (vol[e.musculo] || 0) + n;
    }
  }
  return vol;
}
