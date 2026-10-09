import { html, useState } from '../vendor/preact-htm.js';
import { useStore, actions, toast, navigate } from '../state.js';
import { Card, Btn, Num, Segment, Confirm } from './ui.js';
import { APP_VERSION } from '../version.js';
import * as nube from '../nube.js';

export function Ajustes() {
  const s = useStore();
  const st = s.settings;
  const unit = st.unidad;
  const [confirm, setConfirm] = useState(null);
  const save = (patch) => actions.saveSettings(patch);

  async function onImport(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { await actions.importJSON(await f.text()); toast('Respaldo cargado'); } catch (err) { toast(err.message); }
    e.target.value = '';
  }

  return html`<div class="page">
    <header class="page-h"><h1>Ajustes</h1><${Btn} kind="ghost" small onClick=${() => navigate('hoy')}>Cerrar</${Btn}></header>

    <${Card} title="Tú">
      <div class="field"><label>Nombre</label><input class="text" value=${st.nombre} onInput=${(e) => save({ nombre: e.target.value })} /></div>
      <div class="field"><label>Fecha de nacimiento</label><input class="text" type="date" value=${st.nacimiento || ''} onChange=${(e) => save({ nacimiento: e.target.value || null })} /></div>
      <div class="field"><label>Estatura</label><${Num} value=${st.estatura} onChange=${(v) => save({ estatura: v })} suffix="cm" inputMode="numeric" /></div>
      <div class="field"><label>Peso meta (opcional)</label><${Num} value=${st.metaPeso || null} onChange=${(v) => save({ metaPeso: v })} suffix="kg" /></div>
    </${Card}>

    <${Card} title="Apariencia">
      <div class="field"><label>Vista</label><${Segment} options=${[['oscuro', 'Oscura'], ['claro', 'Clara']]} value=${st.tema || 'oscuro'} onChange=${(t) => save({ tema: t })} /></div>
    </${Card}>

    <${Card} title="Cargas del gym">
      <div class="field"><label>Unidad de las pesas</label><${Segment} options=${[['kg', 'kg'], ['lb', 'lb']]} value=${unit} onChange=${(u) => save({ unidad: u })} /></div>
      <div class="muted small">El peso corporal siempre va en kg. Esto solo cambia cómo capturas las pesas del gym; por dentro todo se guarda en kg.</div>
    </${Card}>

    <${Card} title="Dieta: parámetros">
      <div class="field"><label>Factor de actividad</label><${Num} value=${st.factor} onChange=${(v) => save({ factor: v || 1.55 })} step=${0.05} /></div>
      <div class="field"><label>Déficit (0.20 = 20 %)</label><${Num} value=${st.deficit} onChange=${(v) => save({ deficit: v == null ? 0.2 : v })} step=${0.05} /></div>
      <div class="field"><label>Proteína g/kg</label><${Num} value=${st.proteinaGkg} onChange=${(v) => save({ proteinaGkg: v || 2 })} step=${0.1} /></div>
      <div class="field"><label>Grasa g/kg</label><${Num} value=${st.grasaGkg} onChange=${(v) => save({ grasaGkg: v || 0.8 })} step=${0.1} /></div>
      <div class="muted small">Déficit 0 = semana de mantenimiento. Pon 0 cada 8 a 10 semanas, una semana, y regresa a 0.20.</div>
    </${Card}>

    <${Card} title="Plan de entrenamiento">
      <div class="muted small">Bloque ${s.plan.blockNumber}, ${s.plan.blockSessions} sesiones hechas en este bloque de 20.</div>
      <${Btn} kind="ghost" small onClick=${() => setConfirm('plan')}>Reiniciar bloque y secuencia</${Btn}>
    </${Card}>

    <${Nube} s=${s} />

    <${Card} title="Tus datos">
      <p class="muted small">Archivo de respaldo manual, sin fotos. Con la nube vinculada no hace falta.</p>
      <div class="row gap">
        <${Btn} kind="ghost" small onClick=${() => actions.exportJSON()}>Exportar respaldo</${Btn}>
        <label class="btn btn-ghost btn-sm file-btn">Importar<input type="file" accept="application/json" onChange=${onImport} /></label>
      </div>
      <${Btn} kind="danger" small onClick=${() => setConfirm('todo')}>Borrar todo</${Btn}>
    </${Card}>

    <div class="muted small center">HOD GYM ${APP_VERSION}${s.updateReady ? html` · <a href="#" onClick=${(e) => { e.preventDefault(); location.reload(); }}>Hay versión nueva, toca para actualizar</a>` : ''}</div>

    <${Confirm} open=${confirm === 'plan'} text="Vuelves al bloque 1, semana 1, Superior A. El historial de sesiones se conserva." onYes=${() => { actions.resetPlan(); setConfirm(null); toast('Plan reiniciado'); }} onNo=${() => setConfirm(null)} yes="Reiniciar" />
    <${Confirm} open=${confirm === 'todo'} text=${s.nube && s.nube.estado !== 'off' ? 'Se borra todo lo de este teléfono y se desvincula de la nube. La copia de la nube se queda; con tu liga la recuperas.' : 'Se borra TODO: pesajes, fotos, sesiones y ajustes. No hay vuelta atrás. ¿Seguro?'} onYes=${async () => { nube.desvincular(); await actions.resetAll(); setConfirm(null); navigate('hoy'); }} onNo=${() => setConfirm(null)} yes="Borrar todo" />
  </div>`;
}

function cuando(ts) {
  if (!ts) return 'nunca';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const d = new Date(ts);
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `hoy ${hora}`;
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${hora}`;
}

function Nube({ s }) {
  const n = s.nube || { estado: 'off' };
  const [confirm, setConfirm] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const corre = (fn, ok) => async () => {
    setConfirm(null); setOcupado(true);
    try { await fn(); if (ok) toast(ok); } catch (e) { if (e.status !== 409) toast(e.message); }
    setOcupado(false);
  };

  if (n.estado === 'off') {
    return html`<${Card} title="Respaldo en la nube">
      <p class="muted small">Sin vincular. Abre en este teléfono tu liga de vinculación y todo, fotos incluidas, se respalda solo.</p>
    </${Card}>`;
  }

  const linea = {
    ok: html`<span class="good">Al día</span> · último respaldo ${cuando(n.ultimo)}`,
    subiendo: html`Sincronizando…`,
    error: html`<span class="bad">${n.error}</span>`,
    conflicto: html`<span class="bad">${n.error}</span> ¿Cuál se queda?`,
  }[n.estado] || '';

  return html`<${Card} title="Respaldo en la nube">
    <p class="small">${linea}</p>
    <p class="muted small">Cada cambio se sube solo a tu respaldo privado en Cloudflare: pesajes, sesiones, dieta y fotos.</p>
    ${n.estado === 'conflicto' ? html`<div class="row gap">
      <${Btn} small disabled=${ocupado} onClick=${() => setConfirm('restaurar')}>Usar la nube</${Btn}>
      <${Btn} kind="ghost" small disabled=${ocupado} onClick=${() => setConfirm('forzar')}>Usar este teléfono</${Btn}>
    </div>` : html`<div class="row gap">
      <${Btn} kind="ghost" small disabled=${ocupado} onClick=${corre(() => nube.respaldar({ todo: true }), 'Respaldo al día')}>Respaldar ahora</${Btn}>
      <${Btn} kind="ghost" small disabled=${ocupado} onClick=${() => setConfirm('restaurar')}>Recuperar de la nube</${Btn}>
    </div>`}
    <${Btn} kind="ghost" small onClick=${() => setConfirm('desvincular')}>Desvincular este teléfono</${Btn}>

    <${Confirm} open=${confirm === 'restaurar'} text="Los datos de este teléfono se reemplazan por los de la nube. Las fotos que falten se bajan." onYes=${corre(() => nube.restaurar(), 'Datos recuperados de la nube')} onNo=${() => setConfirm(null)} yes="Recuperar" />
    <${Confirm} open=${confirm === 'forzar'} text="La nube se reemplaza con lo que tiene este teléfono. Lo que solo estaba en la nube se pierde (queda la copia del día anterior)." onYes=${corre(() => nube.respaldar({ forzar: true, todo: true }), 'La nube quedó igual que este teléfono')} onNo=${() => setConfirm(null)} yes="Reemplazar la nube" />
    <${Confirm} open=${confirm === 'desvincular'} text="Este teléfono deja de respaldarse. Lo que ya está en la nube se queda ahí." onYes=${() => { setConfirm(null); nube.desvincular(); toast('Nube desvinculada'); }} onNo=${() => setConfirm(null)} yes="Desvincular" />
  </${Card}>`;
}
