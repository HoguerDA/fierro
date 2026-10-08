import { html, render, useEffect } from './vendor/preact-htm.js';
import { state, useStore, load, navigate } from './state.js';
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
  if (!s.settings.onboarded) return html`<${Onboarding} />`;
  const View = ROUTES[s.route] || Hoy;
  return html`
    <main>${html`<${View} />`}</main>
    <nav class="nav">${NAV.map(([r, label, ico]) => html`<button class=${s.route === r ? 'on' : ''} onClick=${() => navigate(r)}><span class="ico">${ico}</span>${label}${r === 'entrenar' && s.active ? html`<span class="dot"></span>` : null}</button>`)}</nav>
    ${s.toast ? html`<div class="toast">${s.toast}</div>` : null}
    ${s.updateReady ? html`<div class="update" onClick=${() => location.reload()}>Nueva versión lista. Toca para actualizar.</div>` : null}
  `;
}

load().then(() => render(html`<${App} />`, document.getElementById('app')));

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
    } catch (e) { console.warn('SW', e); }
  });
}
