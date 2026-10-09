import { html, render, useEffect } from './vendor/preact-htm.js';
import { state, useStore, load, navigate, toast } from './state.js';
import * as nube from './nube.js';
import { Hoy } from './views/Hoy.js';
import { Entrenar } from './views/Entrenar.js';
import { Dieta } from './views/Dieta.js';
import { Progreso } from './views/Progreso.js';
import { Ajustes } from './views/Ajustes.js';
import { Onboarding } from './views/Onboarding.js';

const ROUTES = { hoy: Hoy, entrenar: Entrenar, dieta: Dieta, progreso: Progreso, ajustes: Ajustes };
const NAV = [['hoy', 'Hoy', '☀'], ['entrenar', 'Entrenar', '⚡'], ['dieta', 'Dieta', '🍽'], ['progreso', 'Progreso', '📈']];

function App() {
  const s = useStore();
  useEffect(() => {
    const onHash = () => { const r = location.hash.replace('#', '') || 'hoy'; if (ROUTES[r] && r !== state.route) navigate(r); };
    window.addEventListener('hashchange', onHash); onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!s.loaded) return html`<div class="splash"><div class="logo">F</div></div>`;
  if (!s.settings.onboarded) return html`<${Onboarding} />${s.toast ? html`<div class="toast">${s.toast}</div>` : null}`;
  const View = ROUTES[s.route] || Hoy;
  return html`
    <main>${html`<${View} />`}</main>
    <nav class="nav">${NAV.map(([r, label, ico]) => html`<button class=${s.route === r ? 'on' : ''} onClick=${() => navigate(r)}><span class="ico">${ico}</span>${label}${r === 'entrenar' && s.active ? html`<span class="dot"></span>` : null}</button>`)}</nav>
    ${s.toast ? html`<div class="toast">${s.toast}</div>` : null}
    ${s.updateReady ? html`<div class="update" onClick=${() => location.reload()}>Nueva versión lista. Toca para actualizar.</div>` : null}
  `;
}

// Liga de vinculación: #vincular=<clave>&url=<worker>. Se lee y se borra de la barra antes de todo.
const vinculo = (() => {
  if (!location.hash.startsWith('#vincular=')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  return { clave: p.get('vincular'), url: p.get('url') };
})();

load().then(async () => {
  nube.iniciar();
  render(html`<${App} />`, document.getElementById('app'));
  if (vinculo) {
    toast('Conectando con la nube…', 10000);
    try {
      const r = await nube.vincular(vinculo.clave, vinculo.url);
      toast(r === 'restaurado' ? 'Listo: tus datos se recuperaron de la nube' : 'Listo: respaldo en la nube activado', 4000);
    } catch (e) { toast(e.message, 5000); }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) { state.updateReady = true; navigate(state.route); }
        });
      });
      // La app instalada casi nunca se recarga: buscar versión nueva al volver a ella y cada 30 min
      const buscar = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
      setInterval(buscar, 30 * 60 * 1000);
    } catch (e) { console.warn('SW', e); }
  });
}
