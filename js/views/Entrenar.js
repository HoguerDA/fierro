import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { useStore, actions, navigate, toast } from '../state.js';
import { Card, Btn, Num, Badge, Sheet, Confirm, Stat, useInterval, Empty } from './ui.js';
import { fmtTime, fmtDate, n0, n1, toUnit, fromUnit, vibrate, beep } from '../util.js';
import { summary, nextSessionTemplate, currentWeek, isDeload } from '../engine/progression.js';

export function Entrenar() {
  const s = useStore();
  if (!s.active) return html`<${SinSesion} s=${s} />`;
  return html`<${Sesion} s=${s} />`;
}

function SinSesion({ s }) {
  const tpl = nextSessionTemplate(s.plan);
  const hist = s.sessions.filter((x) => x.estado === 'terminada').slice().reverse();
  const [open, setOpen] = useState(null);
  return html`<div class="page">
    <header class="page-h"><h1>Entrenar</h1></header>
    <${Card} title="Toca hoy">
      <div class="big2">${tpl.nombre}</div><div class="muted">${tpl.enfasis} · Bloque ${s.plan.blockNumber}, semana ${currentWeek(s.plan)}${isDeload(s.plan) ? ' (descarga)' : ''}</div>
      <ol class="plain">${tpl.ejercicios.map((e) => html`<li><span>${e.nombre}</span><span class="muted">${e.series} × ${e.reps[0]}-${e.reps[1]}</span></li>`)}</ol>
      <${Btn} onClick=${() => actions.startSession()}>Empezar</${Btn}>
    </${Card}>
    <${Card} title="Historial">
      ${hist.length ? hist.map((x) => html`<div class="hist" onClick=${() => setOpen(open === x.id ? null : x.id)}>
        <div class="row between"><div><strong>${x.nombre}</strong> <span class="muted">${fmtDate(x.fecha)}</span></div><span class="muted">${resumenCorto(x)}</span></div>
        ${open === x.id ? html`<div class="hist-d">${x.ejercicios.map((e) => html`<div><span>${e.nombre}</span> <span class="muted">${e.series.filter((t) => t.hecha).map((t) => `${n1(toUnit(t.peso, s.settings.unidad))}×${t.reps}`).join(', ') || 'sin series'}</span></div>`)}</div>` : null}
      </div>`) : html`<${Empty}>Todavía no hay sesiones terminadas.</${Empty}>`}
    </${Card}>
  </div>`;
}

function resumenCorto(x) {
  const n = x.ejercicios.reduce((a, e) => a + e.series.filter((t) => t.hecha).length, 0);
  const min = x.fin ? Math.round((x.fin - x.inicio) / 60000) : null;
  return `${n} series${min ? ` · ${min} min` : ''}`;
}

function Sesion({ s }) {
  const a = s.active;
  const unit = s.settings.unidad;
  const [rest, setRest] = useState(null); // {end, total}
  const [now, setNow] = useState(Date.now());
  const [menu, setMenu] = useState(null); // index del ejercicio con menú abierto
  const [sub, setSub] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [done, setDone] = useState(null);
  const fired = useRef(false);

  useInterval(() => setNow(Date.now()), 1000, true);

  useEffect(() => {
    if (!rest) { fired.current = false; return; }
    if (now >= rest.end && !fired.current) { fired.current = true; vibrate([300, 150, 300, 150, 600]); beep(3); }
  }, [now, rest]);

  const elapsed = Math.round((now - a.inicio) / 1000);
  const totalSets = a.ejercicios.reduce((x, e) => x + e.series.length, 0);
  const doneSets = a.ejercicios.reduce((x, e) => x + e.series.filter((t) => t.hecha).length, 0);

  function setField(ei, si, field, val) {
    actions.updateActive((c) => {
      const kg = field === 'peso' && val != null ? fromUnit(val, unit) : val;
      c.ejercicios[ei].series[si][field] = kg;
    });
  }

  function toggleDone(ei, si) {
    const e = a.ejercicios[ei], st = e.series[si];
    if (!st.hecha && (st.peso == null || st.reps == null)) { toast('Pon peso y reps antes de palomear'); return; }
    actions.updateActive((c) => {
      const t = c.ejercicios[ei].series[si];
      t.hecha = !t.hecha;
      if (t.hecha) {
        // copia peso y reps a la siguiente serie vacía
        const nx = c.ejercicios[ei].series[si + 1];
        if (nx && !nx.hecha) { if (nx.peso == null) nx.peso = t.peso; if (nx.reps == null) nx.reps = t.reps; }
      }
    });
    if (!st.hecha) { setRest({ end: Date.now() + e.descanso * 1000, total: e.descanso }); vibrate(30); }
  }

  function addSet(ei) { actions.updateActive((c) => { const ss = c.ejercicios[ei].series; const l = ss[ss.length - 1]; ss.push({ peso: l ? l.peso : null, reps: null, rir: null, hecha: false }); }); setMenu(null); }
  function removeSet(ei) { actions.updateActive((c) => { const ss = c.ejercicios[ei].series; if (ss.length > 1) ss.pop(); }); setMenu(null); }

  async function finish() {
    setConfirmEnd(false);
    const sess = await actions.finishSession();
    setDone(summary(sess, s.sessions));
    setRest(null);
  }

  const restLeft = rest ? Math.round((rest.end - now) / 1000) : null;

  return html`<div class="page has-rest">
    <header class="page-h">
      <div><h1>${a.nombre}</h1><div class="muted">${a.enfasis} · Bloque ${a.bloque}, semana ${a.semana} · ${fmtTime(elapsed)}</div></div>
      <${Btn} small kind=${doneSets ? 'primary' : 'ghost'} onClick=${() => setConfirmEnd(true)}>Terminar</${Btn}>
    </header>
    ${a.reentry ? html`<div class="banner warn">Sesión de regreso: menos series, 85 % del peso, RIR 3. La próxima ya es normal.</div>` : null}
    ${a.deload ? html`<div class="banner info">Semana de descarga: mitad de series, 90 % del peso, RIR 4. Se trata de recuperar, no de romper récords.</div>` : null}
    <div class="progress"><div style=${`width:${totalSets ? doneSets / totalSets * 100 : 0}%`}></div></div>

    ${a.ejercicios.map((e, ei) => html`<${Card} class=${e.series.every((t) => t.hecha) ? 'ex done' : 'ex'}>
      <header class="card-h">
        <div>
          <h2>${ei + 1}. ${e.nombre}</h2>
          <div class="muted small">${e.musculo} · ${e.series.length} × ${e.reps[0]}-${e.reps[1]}${e.unilateral ? ' c/lado' : ''} · RIR ${e.rir} · descanso ${fmtTime(e.descanso)}</div>
        </div>
        <button class="icon-btn" onClick=${() => setMenu(menu === ei ? null : ei)} aria-label="Opciones">⋯</button>
      </header>
      ${e.nombre !== e.original ? html`<div class="muted small">Sustituye a ${e.original}</div>` : null}
      <div class="sug ${'t-' + e.sugerencia.tendencia}">
        ${e.sugerencia.peso != null ? html`<b>${n1(toUnit(e.sugerencia.peso, unit))} ${unit}</b> · ` : ''}${e.sugerencia.motivo}
      </div>
      ${e.previo ? html`<div class="muted small">Anterior: ${e.previo.map((p) => `${n1(toUnit(p.peso, unit))}×${p.reps}${p.rir != null ? ` @${p.rir}` : ''}`).join(' · ')}</div>` : null}
      <table class="sets">
        <thead><tr><th>#</th><th>${unit}</th><th>reps</th><th>RIR</th><th></th></tr></thead>
        <tbody>${e.series.map((t, si) => html`<tr class=${t.hecha ? 'done' : ''}>
          <td>${si + 1}</td>
          <td><${Num} value=${t.peso == null ? null : Math.round(toUnit(t.peso, unit) * 100) / 100} onChange=${(v) => setField(ei, si, 'peso', v)} placeholder="—" /></td>
          <td><${Num} value=${t.reps} onChange=${(v) => setField(ei, si, 'reps', v == null ? null : Math.round(v))} placeholder=${`${e.reps[0]}-${e.reps[1]}`} inputMode="numeric" /></td>
          <td><select value=${t.rir == null ? '' : t.rir} onChange=${(ev) => setField(ei, si, 'rir', ev.target.value === '' ? null : Number(ev.target.value))}>
            <option value="">–</option>${[0, 1, 2, 3, 4, 5].map((r) => html`<option value=${r}>${r}</option>`)}
          </select></td>
          <td><button class="chk-btn ${t.hecha ? 'on' : ''}" onClick=${() => toggleDone(ei, si)}>${t.hecha ? '✓' : ''}</button></td>
        </tr>`)}</tbody>
      </table>
      ${menu === ei ? html`<div class="menu">
        <button onClick=${() => { setSub(ei); setMenu(null); }}>No hay esta máquina: sustituir</button>
        <button onClick=${() => addSet(ei)}>+ Agregar serie</button>
        <button onClick=${() => removeSet(ei)}>− Quitar última serie</button>
        <div class="menu-note"><b>Técnica:</b> ${e.nota}</div>
      </div>` : null}
    </${Card}>`)}

    <div class="row gap">
      <${Btn} kind="danger" onClick=${() => setConfirmCancel(true)}>Cancelar sesión</${Btn}>
      <${Btn} onClick=${() => setConfirmEnd(true)}>Terminar sesión</${Btn}>
    </div>

    ${rest ? html`<div class="rest ${restLeft <= 0 ? 'over' : ''}">
      <div><div class="rest-t">${restLeft > 0 ? fmtTime(restLeft) : '¡Vas!'}</div><div class="small">${restLeft > 0 ? 'descanso' : 'siguiente serie'}</div></div>
      <div class="row gap">
        <${Btn} kind="ghost" small onClick=${() => setRest({ ...rest, end: rest.end + 30000 })}>+30 s</${Btn}>
        <${Btn} kind="ghost" small onClick=${() => setRest(null)}>Listo</${Btn}>
      </div>
    </div>` : null}

    <${Sheet} open=${sub != null} onClose=${() => setSub(null)} title="Usa en su lugar…">
      ${sub != null ? [...a.ejercicios[sub].sustitutos, ...(a.ejercicios[sub].nombre !== a.ejercicios[sub].original ? [a.ejercicios[sub].original] : [])].map((n) => html`<button class="list-btn" onClick=${() => { actions.substitute(sub, n); setSub(null); }}>${n}</button>`) : null}
      <div class="muted small">El sustituto guarda su propio historial. Si lo usas seguido, la sugerencia de peso también va a progresar.</div>
    </${Sheet}>

    <${Confirm} open=${confirmEnd} text=${doneSets < totalSets ? `Llevas ${doneSets} de ${totalSets} series. ¿Terminar de todos modos?` : '¿Terminar la sesión?'} onYes=${finish} onNo=${() => setConfirmEnd(false)} yes="Terminar" no="Seguir" />
    <${Confirm} open=${confirmCancel} text="Se borra lo registrado hoy y la sesión vuelve a quedar pendiente. ¿Cancelar?" onYes=${() => { setConfirmCancel(false); actions.cancelSession(); setRest(null); navigate('hoy'); }} onNo=${() => setConfirmCancel(false)} yes="Sí, cancelar" no="No" />

    <${Sheet} open=${!!done} onClose=${() => { setDone(null); navigate('hoy'); }} title="Sesión terminada">
      ${done ? html`<div class="stats">
        <${Stat} label="series" value=${done.series} />
        <${Stat} label="tonelaje" value=${n0(toUnit(done.tonelaje, unit))} sub=${unit} />
        <${Stat} label="minutos" value=${done.min != null ? done.min : '–'} />
      </div>
      ${done.prs.length ? html`<div class="banner ok">Récord estimado en: ${done.prs.join(', ')}</div>` : null}
      <${Btn} onClick=${() => { setDone(null); navigate('hoy'); }}>Listo</${Btn}>` : null}
    </${Sheet}>
  </div>`;
}
