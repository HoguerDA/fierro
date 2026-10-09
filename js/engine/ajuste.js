import { addDays, daysBetween, fmtDate } from '../util.js';

// Ajuste automático de la dieta. Vive en settings.dietaAuto:
//   inicio   fecha en que empezó el tramo de dieta actual (se reinicia tras cada semana de descanso)
//   recorte  kcal que se quitan al objetivo por báscula lenta (pasos de 150)
//   revision fecha de la última revisión de peso
//   descanso fecha en que empezó la semana de descanso de dieta, o null
//   pregunta {fecha, bajada} cuando la báscula no bajó y falta saber si se siguió la dieta
//   historial [{fecha, que, bajada?}]
export const REGLA = {
  revisarCada: 14,     // días entre revisiones
  minBajada: 0.4,      // kg que debe bajar el promedio en 2 semanas
  maxBajada: 2.0,      // kg en 2 semanas: más rápido que esto se devuelve un recorte
  paso: 150,           // kcal por ajuste
  recorteMax: 300,     // tope de recortes acumulados
  semanasDieta: 9,     // semanas de déficit antes de la semana de descanso
  diasDescanso: 7,
  minPesajes: 4,       // pesajes por ventana de 7 días para que la revisión cuente
};

function prom(weighins, end) {
  const start = addDays(end, -6);
  const xs = weighins.filter((w) => w.fecha >= start && w.fecha <= end).map((w) => w.kg);
  return { avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, n: xs.length };
}

export function proximaRevision(auto) { return auto ? addDays(auto.revision, REGLA.revisarCada) : null; }
export function proximoDescanso(auto) { return auto ? addDays(auto.inicio, REGLA.semanasDieta * 7) : null; }
export function finDescanso(auto) { return auto && auto.descanso ? addDays(auto.descanso, REGLA.diasDescanso - 1) : null; }

// Devuelve { auto, aviso } con el estado nuevo, o null si no cambió nada.
export function revisarDieta(prev, weighins, hoy) {
  if (!weighins.length) return null;
  let auto = prev ? { ...prev, historial: [...(prev.historial || [])] } : null;
  let aviso = null;
  if (!auto) {
    auto = { inicio: hoy, recorte: 0, revision: hoy, descanso: null, historial: [] };
  }
  const nota = (que, extra = {}) => auto.historial = [...auto.historial, { fecha: hoy, que, ...extra }].slice(-30);

  // Con una pregunta abierta no se decide nada más hasta que se conteste.
  if (auto.pregunta) return null;

  if (auto.descanso) {
    if (daysBetween(auto.descanso, hoy) >= REGLA.diasDescanso) {
      // Fin del descanso: arranca otro tramo y la báscula espera 2 semanas (el agua del descanso sale sola).
      auto = { ...auto, descanso: null, inicio: hoy, revision: hoy };
      nota('fin-descanso');
      aviso = 'Terminó tu semana de descanso de dieta. Regresan las porciones normales.';
    }
  } else if (daysBetween(auto.inicio, hoy) >= REGLA.semanasDieta * 7) {
    auto = { ...auto, descanso: hoy };
    nota('descanso');
    aviso = `Semana de descanso de dieta hasta el ${fmtDate(finDescanso(auto))}: comes a mantenimiento. Las porciones ya vienen aumentadas.`;
  } else if (daysBetween(auto.revision, hoy) >= REGLA.revisarCada) {
    const a = prom(weighins, hoy), b = prom(weighins, addDays(hoy, -REGLA.revisarCada));
    // Sin pesajes suficientes no se decide nada; se vuelve a intentar mañana.
    if (a.n >= REGLA.minPesajes && b.n >= REGLA.minPesajes) {
      const bajada = b.avg - a.avg;
      auto = { ...auto, revision: hoy };
      if (bajada < REGLA.minBajada) {
        // Antes de recortar se pregunta: si se rompió la dieta, el plan no es el problema.
        auto.pregunta = { fecha: hoy, bajada };
      } else if (bajada > REGLA.maxBajada && auto.recorte > 0) {
        auto.recorte -= REGLA.paso;
        nota('devuelve', { bajada });
        aviso = `Revisión de 2 semanas: bajaste ${bajada.toFixed(1)} kg, más rápido de lo sano. Se regresan ${REGLA.paso} kcal de carbohidrato.`;
      } else {
        nota('ok', { bajada });
        aviso = `Revisión de 2 semanas: bajaste ${bajada.toFixed(1)} kg. Vas bien, la dieta sigue igual.`;
      }
    }
  }
  return JSON.stringify(auto) === JSON.stringify(prev) ? null : { auto, aviso };
}

// Respuesta a «¿Cómo seguiste la dieta?». siguio=true recorta (o llega al tope); false no cambia el plan.
export function responderRevision(prev, siguio, hoy) {
  const { bajada } = prev.pregunta;
  const auto = { ...prev, pregunta: null, revision: hoy };
  const nota = (que) => auto.historial = [...(prev.historial || []), { fecha: hoy, que, bajada }].slice(-30);
  let aviso;
  if (!siguio) {
    nota('sin-cumplir');
    aviso = `El plan no cambia. Síguelo bien 2 semanas y el ${fmtDate(addDays(hoy, REGLA.revisarCada))} volvemos a revisar.`;
  } else if (auto.recorte < REGLA.recorteMax) {
    auto.recorte = (auto.recorte || 0) + REGLA.paso;
    nota('recorte');
    aviso = `Se quitan ${REGLA.paso} kcal de carbohidrato. Las porciones ya vienen ajustadas en Dieta.`;
  } else {
    nota('tope');
    aviso = 'Ya no se recorta más comida. Suma 20 minutos de caminata al día.';
  }
  return { auto, aviso };
}
