import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { useStore, actions, toast, state } from '../state.js';
import { Card, Stat, Badge, Segment, PhotoImg, Empty, Btn, Confirm, OjoFotos } from './ui.js';
import { todayKey, addDays, daysBetween, fmtDate, n0, n1, toUnit, parseKey } from '../util.js';
import { MIN_SERIES, SESSIONS, SEQUENCE } from '../data/routine.js';
import { weeklyVolume, history, bestE1rm } from '../engine/progression.js';

// Promedio de los pesajes de los últimos 7 días terminando en `end` (inclusive)
export function avg7(weighins, end = todayKey()) {
  const start = addDays(end, -6);
  const xs = weighins.filter((w) => w.fecha >= start && w.fecha <= end).map((w) => w.kg);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function weightTrend(weighins) {
  const avg = avg7(weighins);
  const prev = avg7(weighins, addDays(todayKey(), -7));
  const last = weighins.length ? weighins[weighins.length - 1].kg : null;
  return { avg, prev, delta: avg != null && prev != null ? avg - prev : null, last };
}

export function Progreso() {
  const s = useStore();
  const [tab, setTab] = useState('peso');
  return html`<div class="page">
    <header class="page-h"><h1>Progreso</h1></header>
    <${Segment} options=${[['peso', 'Peso'], ['fuerza', 'Fuerza'], ['volumen', 'Volumen'], ['fotos', 'Fotos']]} value=${tab} onChange=${setTab} />
    ${tab === 'peso' ? html`<${Peso} s=${s} />` : null}
    ${tab === 'fuerza' ? html`<${Fuerza} s=${s} />` : null}
    ${tab === 'volumen' ? html`<${Volumen} s=${s} />` : null}
    ${tab === 'fotos' ? html`<${Fotos} s=${s} />` : null}
  </div>`;
}

function Peso({ s }) {
  const t = weightTrend(s.weighins);
  const first = s.weighins[0];
  const since14 = avg7(s.weighins, addDays(todayKey(), -14));
  const rate = t.avg != null && since14 != null ? (t.avg - since14) / 2 : null;
  const meta = s.settings.metaPeso;
  const weeksToGoal = rate != null && rate < 0 && meta && t.avg > meta ? (t.avg - meta) / -rate : null;
  const [del, setDel] = useState(null);
  return html`
    <div class="stats">
      <${Stat} label="promedio 7 días" value=${n1(t.avg)} sub="kg" />
      <${Stat} label="vs semana pasada" value=${t.delta == null ? '–' : (t.delta > 0 ? '+' : '') + n1(t.delta)} sub="kg" tone=${t.delta == null ? null : t.delta <= -0.3 ? 'ok' : t.delta > 0 ? 'warn' : null} />
      <${Stat} label="desde el inicio" value=${first && t.last != null ? (t.last - first.kg > 0 ? '+' : '') + n1(t.last - first.kg) : '–'} sub="kg" />
    </div>
    <${Card} title="Últimos 60 días">
      ${s.weighins.length >= 2 ? html`<${WeightChart} weighins=${s.weighins} />` : html`<${Empty}>Con dos pesajes empieza la gráfica. Los puntos son cada día; la línea, el promedio de 7 días. Mira la línea, no los puntos.</${Empty}>`}
      <div class="muted small">${rate != null ? `Ritmo de las últimas 2 semanas: ${rate > 0 ? '+' : ''}${n1(rate)} kg por semana. Meta: entre −0.4 y −0.7.` : 'Con 3 semanas de pesajes te digo el ritmo real.'}
      ${weeksToGoal ? ` A este paso llegas a ${meta} kg en unas ${Math.round(weeksToGoal)} semanas.` : ''}</div>
      ${rate != null && rate > -0.3 && s.weighins.length > 14 ? html`<div class="banner warn">La báscula va lento. Si el promedio sigue así otra semana, se quitan 150 kcal de carbohidrato (ajuste en Dieta).</div>` : null}
    </${Card}>
    <${Card} title="Pesajes">
      ${s.weighins.length ? html`<div class="wlist">${s.weighins.slice().reverse().slice(0, 30).map((w) => html`<div class="row between" onClick=${() => setDel(w.fecha)}><span>${fmtDate(w.fecha)}</span><b>${n1(w.kg)} kg</b></div>`)}</div>` : html`<${Empty}>Todavía no hay pesajes.</${Empty}>`}
    </${Card}>
    <${Confirm} open=${!!del} text=${`¿Borrar el pesaje del ${del ? fmtDate(del) : ''}?`} onYes=${() => { actions.deleteWeighin(del); setDel(null); }} onNo=${() => setDel(null)} yes="Borrar" />`;
}

function WeightChart({ weighins }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = 220;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const end = todayKey(), start = addDays(end, -59);
    const pts = weighins.filter((w) => w.fecha >= start);
    const avg = []; for (let i = 0; i < 60; i++) { const d = addDays(start, i); const a = avg7(weighins, d); if (a != null) avg.push({ d, kg: a }); }
    const all = [...pts.map((p) => p.kg), ...avg.map((a) => a.kg)];
    const lo = Math.floor(Math.min(...all) - 0.5), hi = Math.ceil(Math.max(...all) + 0.5);
    const pad = { l: 36, r: 8, t: 10, b: 22 };
    const x = (d) => pad.l + (daysBetween(start, d) / 59) * (W - pad.l - pad.r);
    const y = (kg) => pad.t + (1 - (kg - lo) / (hi - lo)) * (H - pad.t - pad.b);
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    g.strokeStyle = css.getPropertyValue('--graf-linea'); g.fillStyle = css.getPropertyValue('--graf-texto'); g.font = '11px system-ui'; g.textAlign = 'right';
    for (let k = lo; k <= hi; k += (hi - lo > 8 ? 2 : 1)) { g.beginPath(); g.moveTo(pad.l, y(k)); g.lineTo(W - pad.r, y(k)); g.stroke(); g.fillText(String(k), pad.l - 6, y(k) + 4); }
    g.textAlign = 'center';
    for (let i = 0; i < 60; i += 15) { const d = addDays(start, i); g.fillText(fmtDate(d, false), x(d), H - 6); }
    g.fillStyle = 'rgba(255,122,26,.55)';
    for (const p of pts) { g.beginPath(); g.arc(x(p.fecha), y(p.kg), 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#ff7a1a'; g.lineWidth = 2.5; g.beginPath();
    avg.forEach((a, i) => { i ? g.lineTo(x(a.d), y(a.kg)) : g.moveTo(x(a.d), y(a.kg)); }); g.stroke();
  }, [weighins, state.settings.tema]);
  return html`<canvas ref=${ref} class="chart"></canvas>`;
}

function Fuerza({ s }) {
  const unit = s.settings.unidad;
  const names = [];
  for (const id of SEQUENCE) for (const e of SESSIONS[id].ejercicios) names.push(e.nombre);
  for (const ses of s.sessions) for (const e of ses.ejercicios) if (!names.includes(e.nombre)) names.push(e.nombre);
  const rows = names.map((n) => { const h = history(s.sessions, n).filter((x) => !x.deload && !x.reentry); return { n, h }; }).filter((r) => r.h.length);
  if (!rows.length) return html`<${Empty}>Cuando termines sesiones, aquí ves cómo sube tu fuerza en cada ejercicio (1RM estimado con la fórmula de Epley).</${Empty}>`;
  return html`<${Card} title="1RM estimado por ejercicio">
    ${rows.map(({ n, h }) => { const cur = bestE1rm(h[0].sets); const firstV = bestE1rm(h[h.length - 1].sets); const d = cur - firstV; return html`<div class="strength">
      <div class="row between"><b>${n}</b><span>${n0(toUnit(cur, unit))} ${unit} ${h.length > 1 ? html`<${Badge} tone=${d > 0 ? 'ok' : d < 0 ? 'warn' : 'muted'}>${d > 0 ? '+' : ''}${n0(toUnit(d, unit))}</${Badge}>` : ''}</span></div>
      <div class="muted small">${h.slice(0, 4).map((x) => `${fmtDate(x.fecha, false)}: ${x.sets.map((t) => `${n0(toUnit(t.peso, unit))}×${t.reps}`).join(', ')}`).join('  ·  ')}</div>
    </div>`; })}
  </${Card}>`;
}

function Volumen({ s }) {
  const vol = weeklyVolume(s.sessions);
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const end = addDays(todayKey(), -i * 7), start = addDays(end, -6);
    weeks.push({ start, n: s.sessions.filter((x) => x.estado === 'terminada' && x.fecha >= start && x.fecha <= end).length });
  }
  return html`
    <${Card} title="Series por músculo, últimos 7 días">
      ${Object.keys(MIN_SERIES).map((m) => { const v = vol[m] || 0, min = MIN_SERIES[m]; const pct = Math.min(100, v / Math.max(min, 20) * 100); return html`<div class="vol">
        <div class="row between small"><span>${m}</span><span class=${v >= min ? 'ok' : 'muted'}>${v} / mín ${min}</span></div>
        <div class="vbar"><div class=${v >= min ? 'ok' : ''} style=${`width:${pct}%`}></div></div>
      </div>`; })}
      <div class="muted small">Solo cuenta el músculo principal de cada ejercicio. Con las 4 sesiones de la semana todos quedan en verde.</div>
    </${Card}>
    <${Card} title="Sesiones por semana">
      <div class="weeks">${weeks.map((w) => html`<div class="wk"><div class="wk-bar"><div class=${w.n >= 4 ? 'ok' : ''} style=${`height:${w.n / 4 * 100}%`}></div></div><div class="small muted">${fmtDate(w.start, false)}</div><div class="small">${w.n}</div></div>`)}</div>
    </${Card}>`;
}

function Fotos({ s }) {
  const [sel, setSel] = useState(null);
  const [del, setDel] = useState(null);
  const dates = s.photoDates.slice().reverse();
  if (!dates.length) return html`<${Empty}>Toma la foto de hoy desde la pantalla Hoy. Misma hora, misma luz, misma pose: así se nota el cambio.</${Empty}>`;
  const first = s.photoDates[0];
  const cmp = sel || dates[0];
  return html`
    <${Card} title="Antes y ahora" right=${html`<${OjoFotos} />`}>
      <div class="compare">
        <div><${PhotoImg} getter=${actions.getPhoto} fecha=${first} /><div class="small muted">${fmtDate(first)}</div></div>
        <div><${PhotoImg} getter=${actions.getPhoto} fecha=${cmp} /><div class="small muted">${fmtDate(cmp)}</div></div>
      </div>
      <div class="muted small">${daysBetween(first, cmp)} días de diferencia. Toca una foto abajo para compararla con la primera; mantén presionado para borrarla.</div>
    </${Card}>
    <div class="gallery">${dates.map((d) => html`<div class=${d === cmp ? 'sel' : ''} onClick=${() => setSel(d)} onContextMenu=${(e) => { e.preventDefault(); setDel(d); }}><${PhotoImg} getter=${actions.getPhoto} fecha=${d} /><span>${fmtDate(d, false)}</span></div>`)}</div>
    <${Confirm} open=${!!del} text=${`¿Borrar la foto del ${del ? fmtDate(del) : ''}?`} onYes=${() => { actions.deletePhoto(del); setDel(null); setSel(null); }} onNo=${() => setDel(null)} yes="Borrar" />`;
}
