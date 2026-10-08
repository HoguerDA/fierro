import { html, useState } from '../vendor/preact-htm.js';
import { useStore, actions, navigate, toast } from '../state.js';
import { Card, Btn, Num, Stat, Badge, Sheet, Segment, PhotoImg } from './ui.js';
import { todayKey, fmtDate, n1, n0, addDays } from '../util.js';
import { SEQUENCE, SESSIONS } from '../data/routine.js';
import { PLANS, macros } from '../data/diet.js';
import { targets, dayTargets } from '../engine/nutrition.js';
import { currentWeek, isDeload, isReentry, nextSessionTemplate, lastSessionDate } from '../engine/progression.js';
import { avg7, weightTrend } from './Progreso.js';

export function Hoy() {
  const s = useStore();
  const today = todayKey();
  const w = s.weighins.find((x) => x.fecha === today);
  const [editW, setEditW] = useState(false);
  const [pick, setPick] = useState(false);
  const [draft, setDraft] = useState(null);

  const trend = weightTrend(s.weighins);
  const tpl = nextSessionTemplate(s.plan);
  const week = currentWeek(s.plan);
  const reentry = isReentry(s.sessions);
  const deload = isDeload(s.plan);
  const last = lastSessionDate(s.sessions);
  const sinceMon = (() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; return addDays(today, -dow); })();
  const thisWeek = s.sessions.filter((x) => x.estado === 'terminada' && x.fecha >= sinceMon).length;

  const meal = actions.mealDay(today);
  const plan = PLANS[meal.tipo];
  const base = targets(s.settings, avg7(s.weighins) || (w && w.kg));
  const tg = dayTargets(base, plan.ajusteKcal);
  const eaten = macros(plan.comidas.flatMap((c, i) => (meal.hechas[i] ? c.items : [])));

  async function saveW() {
    if (draft == null) { setEditW(false); return; }
    await actions.setWeighin(today, draft); setEditW(false); toast('Peso guardado');
  }

  async function onPhoto(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { await actions.savePhoto(today, f); toast('Foto guardada'); } catch (err) { toast(err.message); }
    e.target.value = '';
  }

  const hasPhoto = s.photoDates.includes(today);

  return html`<div class="page">
    <header class="page-h">
      <div><h1>${saludo()}${s.settings.nombre ? `, ${s.settings.nombre}` : ''}</h1><div class="muted">${fmtDate(today)}</div></div>
      <button class="icon-btn" onClick=${() => navigate('ajustes')} aria-label="Ajustes">⚙</button>
    </header>

    ${s.active ? html`<${Card} class="accent" onClick=${() => navigate('entrenar')}>
      <div class="row between"><div><div class="muted">Sesión en curso</div><strong>${s.active.nombre}</strong></div><${Btn} small>Continuar</${Btn}></div>
    </${Card}>` : null}

    <div class="grid2">
      <${Card} title="Peso de hoy">
        ${w && !editW ? html`
          <div class="big">${n1(w.kg)} <span class="unit">kg</span></div>
          <div class="muted small">Promedio 7 días: <b>${n1(trend.avg)}</b>${trend.delta != null ? html` · ${trend.delta <= 0 ? '▼' : '▲'} ${n1(Math.abs(trend.delta))} kg vs semana pasada` : ''}</div>
          <${Btn} kind="ghost" small onClick=${() => { setDraft(w.kg); setEditW(true); }}>Corregir</${Btn}>`
        : html`
          <${Num} value=${draft != null ? draft : (w ? w.kg : null)} onChange=${setDraft} placeholder=${trend.last ? n1(trend.last) : '93.0'} suffix="kg" step=${0.1} />
          <${Btn} onClick=${saveW}>Guardar</${Btn}>
          <div class="muted small">Al despertar, después del baño, antes de comer.</div>`}
      </${Card}>

      <${Card} title="Foto de hoy">
        ${hasPhoto ? html`<${PhotoImg} getter=${actions.getPhoto} fecha=${today} class="thumb" onClick=${() => navigate('progreso')} />` : html`<div class="photo-ph thumb"><span>Sin foto</span></div>`}
        <label class="btn btn-${hasPhoto ? 'ghost' : 'primary'} btn-sm file-btn">${hasPhoto ? 'Repetir' : 'Tomar foto'}<input type="file" accept="image/*" onChange=${onPhoto} /></label>
      </${Card}>
    </div>

    <${Card} title="Siguiente sesión" right=${html`<${Badge} tone=${deload ? 'warn' : 'muted'}>Bloque ${s.plan.blockNumber} · Sem ${week}${deload ? ' · Descarga' : ''}</${Badge}>`}>
      <div class="row between">
        <div><div class="big2">${tpl.nombre}</div><div class="muted">${tpl.enfasis} · ${tpl.ejercicios.length} ejercicios</div></div>
      </div>
      ${reentry && last ? html`<div class="banner warn">Llevas más de 10 días sin entrenar (última: ${fmtDate(last)}). Hoy toca sesión de regreso: menos series, 85 % del peso, RIR 3.</div>` : null}
      ${!last ? html`<div class="banner info">Primera sesión. Si ya cargaste tus pesos iniciales en Ajustes, los verás sugeridos; si no, elige el peso en cada ejercicio.</div>` : null}
      <div class="row gap">
        <${Btn} onClick=${() => { actions.startSession(); navigate('entrenar'); }} disabled=${!!s.active}>Empezar</${Btn}>
        <${Btn} kind="ghost" onClick=${() => setPick(true)} disabled=${!!s.active}>Otra sesión</${Btn}>
      </div>
      <div class="muted small">Esta semana: ${thisWeek} de 4 sesiones${last ? ` · última ${fmtDate(last)}` : ''}</div>
    </${Card}>

    <${Card} title="Comidas de hoy" right=${html`<${Segment} options=${[['entreno', 'Entreno'], ['descanso', 'Descanso']]} value=${meal.tipo} onChange=${(t) => actions.setMealDay(today, t)} />`}>
      <ul class="meals">
        ${plan.comidas.map((c, i) => html`<li class=${meal.hechas[i] ? 'done' : ''} onClick=${() => actions.toggleMeal(today, i)}>
          <span class="chk">${meal.hechas[i] ? '✓' : ''}</span>
          <div><div class="meal-n">${c.nombre} <span class="muted">${c.hora}</span></div><div class="muted small">${c.items.map((x) => `${x.alimento} ${x.gramos} g`).join(' · ')}</div></div>
        </li>`)}
      </ul>
      <div class="macro-bar"><div style=${`width:${Math.min(100, eaten.kcal / tg.kcal * 100)}%`}></div></div>
      <div class="row between small muted"><span>${n0(eaten.kcal)} / ${n0(tg.kcal)} kcal</span><span>P ${n0(eaten.p)}/${n0(tg.p)} · C ${n0(eaten.c)}/${n0(tg.c)} · G ${n0(eaten.f)}/${n0(tg.f)}</span></div>
      ${meal.libre ? html`<div class="banner info">Hoy fue tu comida libre. Registrada.</div>` : null}
      <${Btn} kind="ghost" small onClick=${() => navigate('dieta')}>Ver dieta completa</${Btn}>
    </${Card}>

    <${Sheet} open=${pick} onClose=${() => setPick(false)} title="¿Cuál sesión haces hoy?">
      ${SEQUENCE.map((id) => html`<button class="list-btn" onClick=${() => { setPick(false); actions.startSession(id); navigate('entrenar'); }}>
        <div><strong>${SESSIONS[id].nombre}</strong><div class="muted small">${SESSIONS[id].enfasis}</div></div>${id === tpl.id ? html`<${Badge} tone="ok">Toca hoy</${Badge}>` : null}
      </button>`)}
      <button class="list-btn danger" onClick=${() => { setPick(false); actions.skipSession(); toast('Sesión saltada. La siguiente es ' + nextSessionTemplate(s.plan).nombre); }}>Saltar la que toca sin entrenar</button>
    </${Sheet}>
  </div>`;
}

function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
