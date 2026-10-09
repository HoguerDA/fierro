import { ageFrom } from '../util.js';

// Mifflin-St Jeor (hombre) → mantenimiento → objetivo con déficit → macros.
export function targets(settings, pesoKg) {
  const peso = pesoKg || settings.peso || 93;
  const edad = ageFrom(settings.nacimiento);
  const bmr = 10 * peso + 6.25 * (settings.estatura || 177) - 5 * edad + 5;
  const mant = bmr * (settings.factor || 1.55);
  const deficit = settings.deficit == null ? 0.20 : settings.deficit;
  // Ajuste automático (engine/ajuste.js): semana de descanso = mantenimiento; si no, se resta el recorte.
  const auto = settings.dietaAuto || {};
  const descanso = !!auto.descanso;
  const recorte = descanso ? 0 : (auto.recorte || 0);
  const normal = mant * (1 - deficit);
  const kcal = descanso ? mant : normal - recorte;
  // Cuánto se mueven las porciones de carbohidrato del plan respecto al plan base.
  const ajustePlan = kcal - normal;
  const p = peso * (settings.proteinaGkg || 2.0);
  const f = peso * (settings.grasaGkg || 0.8);
  const c = Math.max(0, (kcal - p * 4 - f * 9) / 4);
  const perdidaSemana = ((mant - kcal) * 7) / 7700;
  return { peso, edad, bmr, mant, kcal, p, c, f, perdidaSemana, deficit, descanso, recorte, ajustePlan };
}

// Objetivo del día según el tipo (entreno +100 kcal de carbo, descanso -100).
export function dayTargets(base, ajusteKcal) {
  return { kcal: base.kcal + ajusteKcal, p: base.p, c: base.c + ajusteKcal / 4, f: base.f };
}
