// Respaldo en la nube: copia los datos y las fotos a un Worker de Cloudflare con R2.
// El teléfono sigue siendo la fuente principal; la nube es la copia de seguridad.
import { db, hooks, STORES } from './db.js';
import { state, refresh, load, snapshot } from './state.js';

const LS = 'fierro.nube';
const ESPERA = 10000;      // ms tras el último cambio antes de subir
const REINTENTO = 60000;   // ms tras un error

function leer() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (_) { return {}; }
}
function guardar() {
  try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (_) { /* sin almacenamiento */ }
}
function limpio(c) {
  // base = versión (etag) del respaldo de la nube que este teléfono vio por última vez.
  return { fotos: {}, fotosPend: {}, borrar: [], pendienteDatos: false, ultimo: null, base: '', ...c };
}

let cfg = limpio(leer());
let timer = null;
let corriendo = null;
let otraVez = false;

export function vinculado() { return !!(cfg.url && cfg.clave); }

function estado(patch) { state.nube = { ...(state.nube || {}), ...patch }; refresh(); }

function registros(d) {
  let n = 0;
  for (const s of ['sessions', 'weighins', 'meals']) n += Array.isArray(d && d[s]) ? d[s].length : 0;
  return n;
}

function api(metodo, ruta, cuerpo, tipo) {
  const headers = { Authorization: 'Bearer ' + cfg.clave };
  if (tipo) headers['Content-Type'] = tipo;
  return fetch(cfg.url + ruta, { method: metodo, headers, body: cuerpo, cache: 'no-store' });
}

async function apiJSON(metodo, ruta, cuerpo, tipo) {
  const r = await api(metodo, ruta, cuerpo, tipo);
  let j = null;
  try { j = await r.json(); } catch (_) { /* sin cuerpo */ }
  if (!r.ok) {
    const e = new Error((j && j.error) || `Error ${r.status}`);
    e.status = r.status; e.datos = j;
    throw e;
  }
  return j;
}

// Último respaldo de la nube y su versión. data = null si todavía no hay.
async function bajarDatos() {
  const r = await api('GET', '/datos');
  if (r.status === 404) return { data: null, etag: '' };
  if (!r.ok) {
    let j = null; try { j = await r.json(); } catch (_) { /* nada */ }
    const e = new Error((j && j.error) || `Error ${r.status}`); e.status = r.status; throw e;
  }
  return { data: await r.json(), etag: r.headers.get('X-Etag') || '' };
}

function programar(ms = ESPERA) {
  clearTimeout(timer);
  timer = setTimeout(() => { respaldar().catch(() => {}); }, ms);
}

function hayPendiente() {
  return cfg.pendienteDatos || cfg.borrar.length > 0 || Object.keys(cfg.fotosPend).length > 0;
}

async function marcarFotosLocales() {
  for (const k of await db.keys('photos')) cfg.fotosPend[k] = 1;
  guardar();
}

async function subirFoto(fecha) {
  const rec = await db.get('photos', fecha);
  if (!rec) { delete cfg.fotosPend[fecha]; return; }
  if (cfg.fotos[fecha] === rec.ts) { delete cfg.fotosPend[fecha]; return; }
  const q = `?w=${rec.w || 0}&h=${rec.h || 0}&ts=${rec.ts || 0}`;
  await apiJSON('PUT', '/fotos/' + fecha + q, rec.blob, rec.blob.type || 'image/jpeg');
  cfg.fotos[fecha] = rec.ts;
  delete cfg.fotosPend[fecha];
  guardar();
}

// Sube lo pendiente. forzar = reemplazar la nube aunque tenga más datos.
export function respaldar({ forzar = false, todo = false } = {}) {
  if (!vinculado()) return Promise.resolve();
  if (corriendo) { otraVez = true; return corriendo; }
  clearTimeout(timer);
  corriendo = (async () => {
    if (todo) { cfg.pendienteDatos = true; await marcarFotosLocales(); }
    if (!hayPendiente()) { estado({ estado: 'ok', ultimo: cfg.ultimo, error: null }); return; }
    estado({ estado: 'subiendo', error: null });
    try {
      if (cfg.pendienteDatos) {
        cfg.pendienteDatos = false; guardar();
        try {
          const q = '?base=' + encodeURIComponent(cfg.base || '') + (forzar ? '&forzar=1' : '');
          const j = await apiJSON('PUT', '/datos' + q, JSON.stringify(await snapshot()), 'application/json');
          cfg.base = j.etag || ''; guardar();
        } catch (e) { cfg.pendienteDatos = true; guardar(); throw e; }
      }
      for (const fecha of [...cfg.borrar]) {
        await apiJSON('DELETE', '/fotos/' + fecha);
        cfg.borrar = cfg.borrar.filter((x) => x !== fecha); guardar();
      }
      for (const fecha of Object.keys(cfg.fotosPend)) await subirFoto(fecha);
      cfg.ultimo = Date.now(); guardar();
      estado({ estado: 'ok', ultimo: cfg.ultimo, error: null });
    } catch (e) {
      if (e.status === 409) {
        estado({ estado: 'conflicto', error: e.message });
      } else if (e.status === 401) {
        estado({ estado: 'error', error: 'La clave ya no es válida. Vuelve a vincular.' });
      } else {
        estado({ estado: 'error', error: navigator.onLine === false ? 'Sin conexión. Se reintenta solo.' : e.message + '. Se reintenta solo.' });
        programar(REINTENTO);
      }
      throw e;
    }
  })().finally(() => {
    corriendo = null;
    if (otraVez) { otraVez = false; programar(1500); }
  });
  return corriendo;
}

// Reemplaza los datos del teléfono con los de la nube y baja las fotos que falten.
export async function restaurar() {
  if (!vinculado()) throw new Error('Primero vincula la nube');
  clearTimeout(timer);
  estado({ estado: 'subiendo', error: null });
  try {
    const { data, etag } = await bajarDatos();
    if (!data) { const e = new Error('La nube todavía no tiene respaldo'); e.status = 404; throw e; }
    if (data.app !== 'fierro') throw new Error('El respaldo de la nube no es válido');
    const { fotos } = await apiJSON('GET', '/fotos');
    hooks.mudo = true;
    try {
      for (const s of STORES) {
        if (s === 'photos' || !data[s]) continue;
        await db.clear(s);
        for (const [k, v] of data[s]) await db.put(s, k, v);
      }
      const locales = new Set(await db.keys('photos'));
      for (const f of fotos) {
        if (locales.has(f.id)) continue;
        const r = await api('GET', '/fotos/' + f.id);
        if (!r.ok) continue;
        const blob = await r.blob();
        const ts = Number(r.headers.get('X-Foto-Ts')) || f.ts || Date.now();
        await db.put('photos', f.id, {
          fecha: f.id, blob, ts,
          w: Number(r.headers.get('X-Foto-W')) || 0,
          h: Number(r.headers.get('X-Foto-H')) || 0,
        });
        cfg.fotos[f.id] = ts;
      }
      // Fotos que solo estaban en el teléfono: se suben después.
      const enNube = new Set(fotos.map((f) => f.id));
      for (const k of locales) if (!enNube.has(k)) cfg.fotosPend[k] = 1;
    } finally { hooks.mudo = false; }
    cfg.pendienteDatos = false; cfg.ultimo = Date.now(); cfg.base = etag; guardar();
    await load();
    estado({ estado: 'ok', ultimo: cfg.ultimo, error: null });
    if (hayPendiente()) programar(2000);
  } catch (e) {
    estado({ estado: 'error', error: e.status === 404 ? 'La nube todavía no tiene respaldo.' : e.message });
    throw e;
  }
}

// Guarda la clave y decide: si la nube tiene más datos, los recupera; si no, sube los del teléfono.
export async function vincular(clave, url) {
  if (!clave || !url) throw new Error('La liga de vinculación está incompleta');
  const antes = cfg;
  cfg = limpio({ clave, url: url.replace(/\/+$/, '') });
  try {
    await apiJSON('GET', '/ping');
  } catch (e) {
    cfg = antes;
    throw new Error(e.status === 401 ? 'La clave de la nube no es válida' : 'No pude conectar con la nube');
  }
  guardar();
  const { data: nube, etag } = await bajarDatos();
  cfg.base = etag; guardar();
  if (nube && nube.app === 'fierro') {
    const local = await snapshot();
    if (!state.settings.onboarded || registros(local) < registros(nube)) {
      await restaurar();
      return 'restaurado';
    }
  }
  await respaldar({ todo: true });
  return 'respaldado';
}

export function desvincular() {
  clearTimeout(timer);
  cfg = limpio({});
  try { localStorage.removeItem(LS); } catch (_) { /* nada */ }
  estado({ estado: 'off', ultimo: null, error: null });
}

export function iniciar() {
  hooks.onWrite = (store, key, op) => {
    if (!vinculado()) return;
    if (store === 'photos') {
      if (op === 'put') cfg.fotosPend[key] = 1;
      else if (op === 'del') {
        delete cfg.fotosPend[key];
        if (cfg.fotos[key] != null) { delete cfg.fotos[key]; cfg.borrar.push(key); }
      }
      // 'clear' (Borrar todo) no toca la nube.
    } else {
      cfg.pendienteDatos = true;
    }
    guardar();
    programar();
  };
  estado(vinculado() ? { estado: 'ok', ultimo: cfg.ultimo, error: null } : { estado: 'off' });
  if (vinculado() && hayPendiente()) programar(3000);
  window.addEventListener('online', () => { if (vinculado() && hayPendiente()) programar(1000); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && vinculado() && hayPendiente()) respaldar().catch(() => {});
  });
}
