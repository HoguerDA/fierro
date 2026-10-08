export const KG_PER_LB = 0.45359237;

export function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k, n) {
  const d = parseKey(k); d.setDate(d.getDate() + n); return todayKey(d);
}

export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmtDate(k, withDay = true) {
  const d = parseKey(k);
  return `${withDay ? DIAS[d.getDay()] + ' ' : ''}${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function n1(x) { return x == null || isNaN(x) ? '–' : (Math.round(x * 10) / 10).toLocaleString('es-MX'); }
export function n0(x) { return x == null || isNaN(x) ? '–' : Math.round(x).toLocaleString('es-MX'); }

export function ageFrom(birth) {
  if (!birth) return 24;
  const b = parseKey(birth), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

// Peso para mostrar según unidades
export function toUnit(kg, unit) { return unit === 'lb' ? kg / KG_PER_LB : kg; }
export function fromUnit(x, unit) { return unit === 'lb' ? x * KG_PER_LB : x; }
export function roundToPlate(x, unit) {
  const step = unit === 'lb' ? 5 : 2.5;
  return Math.round(x / step) * step;
}

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function vibrate(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) { /* nada */ } }

let audioCtx = null;
export function beep(times = 2) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 880; g.gain.value = 0.15;
      const t = audioCtx.currentTime + i * 0.25;
      o.start(t); o.stop(t + 0.15);
    }
  } catch (_) { /* sin audio */ }
}

// Redimensiona una imagen a máximo `max` px por lado y la devuelve como Blob JPEG.
export function shrinkImage(file, max = 1280, quality = 0.85) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => b ? res({ blob: b, w: c.width, h: c.height }) : rej(new Error('No se pudo procesar la foto')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Foto inválida')); };
    img.src = url;
  });
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
