import { html, useState } from '../vendor/preact-htm.js';
import { useStore, actions, toast } from '../state.js';
import { Card, Btn, Segment, Badge, Sheet } from './ui.js';
import { n0, n1, todayKey, addDays, fmtDate } from '../util.js';
import { planDelDia, SWAPS, RULES, macros, FOODS } from '../data/diet.js';
import { proximaRevision, proximoDescanso, finDescanso } from '../engine/ajuste.js';
import { targets, dayTargets } from '../engine/nutrition.js';
import { avg7 } from './Progreso.js';

export function Dieta() {
  const s = useStore();
  const [tab, setTab] = useState('plan');
  const [tipo, setTipo] = useState(actions.mealDay(todayKey()).tipo);
  const [libre, setLibre] = useState(false);
  const [nota, setNota] = useState('');
  const peso = avg7(s.weighins) || (s.weighins.length ? s.weighins[s.weighins.length - 1].kg : null);
  const base = targets(s.settings, peso);
  const plan = planDelDia(tipo, base.ajustePlan);
  const auto = s.settings.dietaAuto;
  const tg = dayTargets(base, plan.ajusteKcal);
  const tot = macros(plan.comidas.flatMap((c) => c.items));

  const today = todayKey();
  const dow = (new Date().getDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const libreSemana = Object.values(s.meals).find((m) => m.libre && m.fecha >= monday && m.fecha <= addDays(monday, 6));

  return html`<div class="page">
    <header class="page-h"><h1>Dieta</h1></header>
    <${Segment} options=${[['plan', 'Plan'], ['cambios', 'Cambios'], ['reglas', 'Reglas'], ['numeros', 'Números']]} value=${tab} onChange=${setTab} />

    ${tab === 'plan' ? html`
      <${Segment} options=${[['entreno', 'Día de entreno'], ['descanso', 'Día de descanso']]} value=${tipo} onChange=${setTipo} />
      <p class="muted small">${plan.descripcion}</p>
      ${base.descanso ? html`<div class="banner ok">Semana de descanso de dieta hasta el ${fmtDate(finDescanso(auto))}. Comes a mantenimiento: el carbohidrato ya viene aumentado.</div>`
        : base.recorte ? html`<div class="banner info">Ajuste automático: −${base.recorte} kcal porque la báscula iba lenta. El carbohidrato ya viene ajustado.</div>` : null}
      ${plan.comidas.map((c) => { const m = macros(c.items); return html`<${Card} title=${`${c.nombre} · ${c.hora}`} right=${html`<span class="muted small">${n0(m.kcal)} kcal</span>`}>
        <ul class="food">${c.items.map((x) => html`<li><div><span>${x.alimento}</span>${x.nota ? html`<div class="muted small">${x.nota}</div>` : null}</div><b>${x.gramos} g</b></li>`)}</ul>
        <div class="muted small">P ${n0(m.p)} · C ${n0(m.c)} · G ${n0(m.f)}</div>
      </${Card}>`; })}
      <${Card} title="Total del día">
        <table class="tbl"><thead><tr><th></th><th>Plan</th><th>Objetivo</th><th>Dif.</th></tr></thead><tbody>
          ${[['kcal', tot.kcal, tg.kcal], ['Proteína g', tot.p, tg.p], ['Carbos g', tot.c, tg.c], ['Grasa g', tot.f, tg.f]].map(([l, a, b]) => html`<tr><td>${l}</td><td>${n0(a)}</td><td>${n0(b)}</td><td class=${Math.abs(a - b) / b > 0.08 ? 'warn' : 'ok'}>${a - b > 0 ? '+' : ''}${n0(a - b)}</td></tr>`)}
        </tbody></table>
        <div class="muted small">El objetivo se recalcula solo con tu promedio de peso de 7 días (${peso ? n1(peso) + ' kg' : 'sin pesajes aún'}). Las porciones del plan son fijas: cuando la diferencia pase de 8 % te lo marco y ajustamos.</div>
      </${Card}>
      <${Card} title="Comida libre de la semana">
        ${libreSemana ? html`<div class="banner ok">Ya la usaste: ${fmtDate(libreSemana.fecha)}${libreSemana.nota ? ` · ${libreSemana.nota}` : ''}</div>` : html`<p class="muted small">Una a la semana, planeada el día antes. Se registra, no se esconde.</p>`}
        <${Btn} kind=${libreSemana ? 'ghost' : 'primary'} small onClick=${() => setLibre(true)}>${libreSemana ? 'Registrar otra (hoy)' : 'Registrar comida libre hoy'}</${Btn}>
      </${Card}>` : null}

    ${tab === 'cambios' ? html`<${Card} title="Cambios equivalentes">
      ${SWAPS.map(([k, v]) => html`<div class="swap"><b>${k}</b><div>${v}</div></div>`)}
    </${Card}>` : null}

    ${tab === 'reglas' ? html`<${Card} title="Reglas">
      <ol class="rules">${RULES.map((r) => html`<li>${r}</li>`)}</ol>
    </${Card}>` : null}

    ${tab === 'numeros' ? html`<${Card} title="De dónde salen los números">
      <table class="tbl"><tbody>
        <tr><td>Peso usado</td><td>${n1(base.peso)} kg</td></tr>
        <tr><td>Edad</td><td>${base.edad}</td></tr>
        <tr><td>Metabolismo basal (Mifflin-St Jeor)</td><td>${n0(base.bmr)} kcal</td></tr>
        <tr><td>Mantenimiento (× ${s.settings.factor})</td><td>${n0(base.mant)} kcal</td></tr>
        ${base.descanso ? html`<tr><td>Objetivo (semana de descanso: mantenimiento)</td><td>${n0(base.kcal)} kcal</td></tr>`
          : html`<tr><td>Objetivo (déficit ${Math.round(base.deficit * 100)} %${base.recorte ? `, −${base.recorte} de ajuste` : ''})</td><td>${n0(base.kcal)} kcal</td></tr>`}
        <tr><td>Proteína (${s.settings.proteinaGkg} g/kg)</td><td>${n0(base.p)} g</td></tr>
        <tr><td>Grasa (${s.settings.grasaGkg} g/kg)</td><td>${n0(base.f)} g</td></tr>
        <tr><td>Carbohidrato (lo que queda)</td><td>${n0(base.c)} g</td></tr>
        <tr><td>Pérdida esperada</td><td>${n1(base.perdidaSemana)} kg/semana</td></tr>
        ${auto ? html`<tr><td>Próxima revisión de peso</td><td>${fmtDate(proximaRevision(auto))}</td></tr>
        <tr><td>${auto.descanso ? 'Fin de la semana de descanso' : 'Próxima semana de descanso'}</td><td>${fmtDate(auto.descanso ? finDescanso(auto) : proximoDescanso(auto))}</td></tr>` : null}
      </tbody></table>
      <div class="muted small">Día de entreno: +100 kcal de carbohidrato. Día de descanso: −100. Todo esto se ajusta solo: no tienes que mover nada.</div>
      <h3>Tabla de alimentos (por 100 g)</h3>
      <table class="tbl small"><thead><tr><th>Alimento</th><th>kcal</th><th>P</th><th>C</th><th>G</th></tr></thead><tbody>
        ${Object.entries(FOODS).map(([k, v]) => html`<tr><td>${k}</td><td>${v[0]}</td><td>${v[1]}</td><td>${v[2]}</td><td>${v[3]}</td></tr>`)}
      </tbody></table>
    </${Card}>` : null}

    <${Sheet} open=${libre} onClose=${() => setLibre(false)} title="Comida libre de hoy">
      <input class="text" placeholder="¿Qué fue? (pizza, tacos…)" value=${nota} onInput=${(e) => setNota(e.target.value)} />
      <${Btn} onClick=${async () => { await actions.setFreeMeal(today, true, nota); setLibre(false); setNota(''); toast('Registrada. Mañana sigue el plan normal.'); }}>Guardar</${Btn}>
    </${Sheet}>
  </div>`;
}
