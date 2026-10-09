import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, actions } from '../state.js';

export function Card({ title, right, children, class: cls = '', onClick }) {
  return html`<section class="card ${cls}" onClick=${onClick}>
    ${title ? html`<header class="card-h"><h2>${title}</h2>${right ? html`<div class="card-r">${right}</div>` : null}</header>` : null}
    ${children}
  </section>`;
}

export function Btn({ children, onClick, kind = 'primary', small, disabled, class: cls = '', type = 'button' }) {
  return html`<button type=${type} class="btn btn-${kind} ${small ? 'btn-sm' : ''} ${cls}" onClick=${onClick} disabled=${disabled}>${children}</button>`;
}

// Campo numérico grande. value puede ser null. onChange recibe número o null.
export function Num({ value, onChange, step = 0.5, min = 0, placeholder = '', suffix, class: cls = '', inputMode = 'decimal', autoFocus }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  useEffect(() => { setTxt(value == null ? '' : String(value)); }, [value]);
  return html`<label class="num ${cls}">
    <input type="text" inputmode=${inputMode} placeholder=${placeholder} value=${txt} autoFocus=${autoFocus}
      onInput=${(e) => setTxt(e.target.value)}
      onFocus=${(e) => e.target.select()}
      onBlur=${() => { const v = parseFloat(txt.replace(',', '.')); onChange(isNaN(v) ? null : Math.max(min, v)); }} />
    ${suffix ? html`<span class="suffix">${suffix}</span>` : null}
  </label>`;
}

export function Stat({ label, value, sub, tone }) {
  return html`<div class="stat ${tone ? 'tone-' + tone : ''}"><div class="stat-v">${value}</div><div class="stat-l">${label}</div>${sub ? html`<div class="stat-s">${sub}</div>` : null}</div>`;
}

export function Badge({ children, tone = 'muted' }) { return html`<span class="badge badge-${tone}">${children}</span>`; }

export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return html`<div class="sheet-bg" onClick=${onClose}>
    <div class="sheet" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet-handle"></div>
      ${title ? html`<h3>${title}</h3>` : null}
      ${children}
    </div>
  </div>`;
}

export function Segment({ options, value, onChange }) {
  return html`<div class="segment">${options.map(([v, label]) => html`<button type="button" class=${v === value ? 'on' : ''} onClick=${() => onChange(v)}>${label}</button>`)}</div>`;
}

export function Empty({ children }) { return html`<p class="empty">${children}</p>`; }

export function Confirm({ open, text, onYes, onNo, yes = 'Sí', no = 'No' }) {
  return html`<${Sheet} open=${open} onClose=${onNo}>
    <p class="confirm-text">${text}</p>
    <div class="row gap"><${Btn} kind="ghost" onClick=${onNo}>${no}</${Btn}><${Btn} onClick=${onYes}>${yes}</${Btn}></div>
  </${Sheet}>`;
}

// Foto desde IndexedDB → <img>
export function PhotoImg({ getter, fecha, class: cls = '', onClick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u = null;
    getter(fecha).then((p) => { if (p && p.blob) { u = URL.createObjectURL(p.blob); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [fecha]);
  const borrosa = state.settings.fotosBorrosas ? 'borrosa' : '';
  return url ? html`<img class="${cls} ${borrosa}" src=${url} alt="Foto ${fecha}" onClick=${onClick} />` : html`<div class="photo-ph ${cls}"></div>`;
}

// Botón del ojo: desenfoca o muestra todas las fotos. Se queda como lo dejes.
export function OjoFotos() {
  const oculto = !!state.settings.fotosBorrosas;
  return html`<button class="ojo" aria-label=${oculto ? 'Mostrar fotos' : 'Desenfocar fotos'} title=${oculto ? 'Mostrar fotos' : 'Desenfocar fotos'}
    onClick=${(e) => { e.stopPropagation(); actions.saveSettings({ fotosBorrosas: !oculto }); }}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
      ${oculto ? html`<line x1="3" y1="3" x2="21" y2="21" />` : null}
    </svg>
  </button>`;
}

export function useInterval(fn, ms, active = true) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { if (!active) return; const id = setInterval(() => ref.current(), ms); return () => clearInterval(id); }, [ms, active]);
}
