import { useState, useLayoutEffect } from './vendor/preact-htm.js';
import { db, STORES } from './db.js';
import { todayKey, shrinkImage, download, uid } from './util.js';
import { SESSIONS, SEQUENCE } from './data/routine.js';
import { defaultPlan, buildSession, advancePlan, substitute as subst } from './engine/progression.js';

export const DEFAULT_SETTINGS = {
  nombre: '',
  estatura: null,      // cm
  nacimiento: null,    // 'YYYY-MM-DD'
  peso: null,          // kg inicial
  unidad: 'kg',        // 'kg' | 'lb' para las cargas del gym
  factor: 1.55,
  deficit: 0.20,
  proteinaGkg: 2.0,
  grasaGkg: 0.8,
  onboarded: false,
};

export const state = {
  loaded: false,
  route: 'hoy',
  settings: { ...DEFAULT_SETTINGS },
  plan: defaultPlan(),
  startingWeights: {},
  sessions: [],       // terminadas y canceladas
  weighins: [],       // [{fecha, kg}] ordenado por fecha
  meals: {},          // fecha -> {tipo, hechas:{i:true}, libre:bool, nota}
  photoDates: [],     // fechas con foto
  active: null,       // sesión en curso
  toast: null,
  updateReady: false,
};

const listeners = new Set();
function emit() { for (const l of listeners) l(); }
export const refresh = emit;

// Todo menos las fotos, en el formato del respaldo.
export async function snapshot() {
  const data = { app: 'fierro', version: 1, exportado: new Date().toISOString() };
  for (const s of STORES) {
    if (s === 'photos') continue;
    const keys = await db.keys(s), vals = await db.all(s);
    data[s] = keys.map((k, i) => [k, vals[i]]);
  }
  return data;
}

export function useStore() {
  const [, set] = useState(0);
  // useLayoutEffect: se suscribe en el mismo render, así no se pierde un aviso que llegue justo después de montar.
  useLayoutEffect(() => { const f = () => set((x) => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return state;
}

export async function load() {
  const [settings, plan, sw, sessions, weighins, meals, photoKeys, active] = await Promise.all([
    db.get('kv', 'settings'), db.get('kv', 'plan'), db.get('kv', 'startingWeights'),
    db.all('sessions'), db.all('weighins'), db.all('meals'), db.keys('photos'), db.get('kv', 'active'),
  ]);
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  state.plan = plan || defaultPlan();
  state.startingWeights = sw || {};
  state.sessions = (sessions || []).sort((a, b) => (a.fecha + a.inicio < b.fecha + b.inicio ? -1 : 1));
  state.weighins = (weighins || []).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  state.meals = Object.fromEntries((meals || []).map((m) => [m.fecha, m]));
  state.photoDates = (photoKeys || []).sort();
  state.active = active || null;
  state.loaded = true;
  if (!state.nube) state.nube = { estado: 'off' };
  emit();
}

export function navigate(route) { state.route = route; location.hash = route; emit(); window.scrollTo(0, 0); }

export function toast(msg, ms = 2500) {
  state.toast = msg; emit();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { state.toast = null; emit(); }, ms);
}

export const actions = {
  async saveSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    await db.put('kv', 'settings', state.settings); emit();
  },

  // ---- Peso ----
  async setWeighin(fecha, kg) {
    const w = { fecha, kg };
    await db.put('weighins', fecha, w);
    state.weighins = [...state.weighins.filter((x) => x.fecha !== fecha), w].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    emit();
  },
  async deleteWeighin(fecha) {
    await db.del('weighins', fecha);
    state.weighins = state.weighins.filter((x) => x.fecha !== fecha); emit();
  },

  // ---- Fotos ----
  async savePhoto(fecha, file) {
    const { blob, w, h } = await shrinkImage(file);
    await db.put('photos', fecha, { fecha, blob, w, h, ts: Date.now() });
    if (!state.photoDates.includes(fecha)) state.photoDates = [...state.photoDates, fecha].sort();
    emit();
  },
  getPhoto(fecha) { return db.get('photos', fecha); },
  async deletePhoto(fecha) {
    await db.del('photos', fecha);
    state.photoDates = state.photoDates.filter((d) => d !== fecha); emit();
  },

  // ---- Entrenamiento ----
  async startSession(templateId) {
    const template = SESSIONS[templateId || SEQUENCE[state.plan.seqIndex % SEQUENCE.length]];
    state.active = buildSession(template, state.plan, state.sessions, state.startingWeights, state.settings.unidad);
    await db.put('kv', 'active', state.active);
    await actions.setMealDay(todayKey(), 'entreno', true);
    emit();
  },
  async updateActive(mut) {
    const copy = JSON.parse(JSON.stringify(state.active));
    mut(copy);
    state.active = copy;
    emit();
    await db.put('kv', 'active', copy);
  },
  async substitute(index, nombre) {
    state.active = subst(state.active, index, nombre, state.sessions, state.startingWeights, state.settings.unidad);
    emit(); await db.put('kv', 'active', state.active);
  },
  async finishSession() {
    const s = { ...state.active, estado: 'terminada', fin: Date.now() };
    await db.put('sessions', s.id, s);
    state.sessions = [...state.sessions, s];
    // La siguiente sesión es la que sigue a la que HICISTE, aunque hayas cambiado el orden.
    const idx = SEQUENCE.indexOf(s.plantilla);
    state.plan = { ...advancePlan(state.plan), seqIndex: (idx + 1) % SEQUENCE.length };
    await db.put('kv', 'plan', state.plan);
    state.active = null; await db.del('kv', 'active');
    emit();
    return s;
  },
  async cancelSession() {
    state.active = null; await db.del('kv', 'active'); emit();
  },
  async skipSession() {
    state.plan = advancePlan(state.plan);
    await db.put('kv', 'plan', state.plan); emit();
  },
  async setStartingWeight(id, kg) {
    const sw = { ...state.startingWeights };
    if (kg == null || isNaN(kg)) delete sw[id]; else sw[id] = kg;
    state.startingWeights = sw; await db.put('kv', 'startingWeights', sw); emit();
  },
  async resetPlan() {
    state.plan = defaultPlan(); await db.put('kv', 'plan', state.plan); emit();
  },

  // ---- Dieta ----
  mealDay(fecha) {
    return state.meals[fecha] || { fecha, tipo: 'entreno', hechas: {}, libre: false, nota: '' };
  },
  async setMealDay(fecha, tipo, soloSiNoExiste = false) {
    const cur = state.meals[fecha];
    if (soloSiNoExiste && cur) return;
    const m = { ...actions.mealDay(fecha), tipo };
    if (cur && cur.tipo !== tipo) m.hechas = {};
    await db.put('meals', fecha, m); state.meals = { ...state.meals, [fecha]: m }; emit();
  },
  async toggleMeal(fecha, i) {
    const m = actions.mealDay(fecha);
    const hechas = { ...m.hechas, [i]: !m.hechas[i] };
    const n = { ...m, hechas };
    await db.put('meals', fecha, n); state.meals = { ...state.meals, [fecha]: n }; emit();
  },
  async setFreeMeal(fecha, libre, nota = '') {
    const n = { ...actions.mealDay(fecha), libre, nota };
    await db.put('meals', fecha, n); state.meals = { ...state.meals, [fecha]: n }; emit();
  },

  // ---- Datos ----
  async exportJSON() {
    download(`hod-gym-${todayKey()}.json`, JSON.stringify(await snapshot(), null, 1));
  },
  async importJSON(text) {
    const data = JSON.parse(text);
    if (data.app !== 'fierro') throw new Error('Ese archivo no es un respaldo de HOD GYM');
    for (const s of STORES) {
      if (!data[s]) continue;
      for (const [k, v] of data[s]) await db.put(s, k, v);
    }
    await load();
  },
  async resetAll() {
    for (const s of STORES) await db.clear(s);
    await load();
  },
};

export { uid };
