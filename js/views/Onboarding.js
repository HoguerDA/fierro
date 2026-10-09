import { html, useState } from '../vendor/preact-htm.js';
import { actions, toast } from '../state.js';
import { Btn, Num, Segment } from './ui.js';
import { todayKey } from '../util.js';

export function Onboarding() {
  const [d, setD] = useState({ nombre: '', nacimiento: '', estatura: null, peso: null, unidad: 'kg', metaPeso: null });
  const ok = d.estatura && d.peso && d.nacimiento;
  async function go() {
    await actions.saveSettings({ ...d, nacimiento: d.nacimiento || null, onboarded: true });
    await actions.setWeighin(todayKey(), d.peso);
    toast('Listo. Primer pesaje guardado.');
  }
  return html`<div class="page onboard">
    <div class="logo">F</div>
    <h1>HOD GYM</h1>
    <p class="muted">Tu gym y tu dieta, con números. Cuatro datos y empezamos.</p>
    <div class="field"><label>¿Cómo te llamo?</label><input class="text" value=${d.nombre} onInput=${(e) => setD({ ...d, nombre: e.target.value })} placeholder="Hoguer" /></div>
    <div class="field"><label>Fecha de nacimiento</label><input class="text" type="date" value=${d.nacimiento} onChange=${(e) => setD({ ...d, nacimiento: e.target.value })} /></div>
    <div class="field"><label>Estatura</label><${Num} value=${d.estatura} onChange=${(v) => setD({ ...d, estatura: v })} suffix="cm" inputMode="numeric" placeholder="177" /></div>
    <div class="field"><label>Peso de hoy</label><${Num} value=${d.peso} onChange=${(v) => setD({ ...d, peso: v })} suffix="kg" placeholder="93.0" /></div>
    <div class="field"><label>Peso meta (opcional)</label><${Num} value=${d.metaPeso} onChange=${(v) => setD({ ...d, metaPeso: v })} suffix="kg" placeholder="78" /></div>
    <div class="field"><label>Las pesas del gym las cuento en</label><${Segment} options=${[['kg', 'kg'], ['lb', 'lb']]} value=${d.unidad} onChange=${(u) => setD({ ...d, unidad: u })} /></div>
    <${Btn} onClick=${go} disabled=${!ok}>Empezar</${Btn}>
    <p class="muted small">Todo se guarda en tu teléfono. ¿Ya tenías HOD GYM? Abre tu liga de vinculación y tus datos regresan solos.</p>
  </div>`;
}
