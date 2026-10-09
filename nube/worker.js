// HOD GYM · respaldo en la nube (Cloudflare Worker + R2).
// Guarda los datos de la app y las fotos de progreso en el bucket privado hod-gym.
// Los respaldos llevan app:'fierro', el nombre interno original de la app.
// Solo responde a quien trae la clave (secreto CLAVE del Worker).
//
//   GET    /ping            comprueba la clave
//   GET    /datos           último respaldo (JSON)
//   PUT    /datos?base=ETAG sube respaldo; ETAG = versión que el teléfono vio por última vez.
//                            Si la nube cambió desde entonces (u otro teléfono escribió) responde 409.
//                            ?forzar=1 reemplaza de todos modos.
//   GET    /fotos           lista de fotos [{id, bytes, ts}]
//   GET    /fotos/AAAA-MM-DD   descarga una foto
//   PUT    /fotos/AAAA-MM-DD   sube una foto (?w=&h=&ts=)
//   DELETE /fotos/AAAA-MM-DD   borra una foto

const ORIGENES = ['https://hoguerda.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const MAX_DATOS = 10 * 1024 * 1024;
const MAX_FOTO = 15 * 1024 * 1024;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function corsHeaders(req) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const o = req.headers.get('Origin');
  if (o && ORIGENES.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function claveValida(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const dada = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!dada || !env.CLAVE) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(dada)),
    crypto.subtle.digest('SHA-256', enc.encode(env.CLAVE)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// Cuántos registros trae un respaldo: sirve para no pisar uno lleno con uno vacío.
function registros(d) {
  let n = 0;
  for (const s of ['sessions', 'weighins', 'meals']) n += Array.isArray(d[s]) ? d[s].length : 0;
  return n;
}

async function leerLimitado(req, max) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > max) return null;
  const buf = await req.arrayBuffer();
  return buf.byteLength > max ? null : buf;
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const ruta = url.pathname.replace(/\/+$/, '') || '/';

    if (!(await claveValida(req, env))) return json({ error: 'Clave inválida' }, 401, cors);

    try {
      if (ruta === '/ping' && req.method === 'GET') return json({ ok: true }, 200, cors);

      if (ruta === '/datos') {
        if (req.method === 'GET') {
          const obj = await env.BUCKET.get('datos/actual.json');
          if (!obj) return json({ error: 'Sin respaldo todavía' }, 404, cors);
          return new Response(obj.body, {
            headers: {
              ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
              'X-Etag': obj.etag, 'X-Guardado': obj.uploaded.toISOString(),
              'Access-Control-Expose-Headers': 'X-Etag, X-Guardado',
            },
          });
        }
        if (req.method === 'PUT') {
          const buf = await leerLimitado(req, MAX_DATOS);
          if (!buf) return json({ error: 'Respaldo demasiado grande' }, 413, cors);
          const texto = new TextDecoder().decode(buf);
          let d;
          try { d = JSON.parse(texto); } catch (_) { return json({ error: 'JSON inválido' }, 400, cors); }
          if (!d || d.app !== 'fierro') return json({ error: 'No es un respaldo de HOD GYM' }, 400, cors);

          if (url.searchParams.get('forzar') !== '1') {
            const prev = await env.BUCKET.get('datos/actual.json');
            if (prev) {
              if (prev.etag !== (url.searchParams.get('base') || '')) {
                return json({ error: 'La nube cambió desde otro teléfono.', motivo: 'version' }, 409, cors);
              }
              const nPrev = registros(await prev.json());
              const nNuevo = registros(d);
              if (nPrev >= 5 && nNuevo < nPrev * 0.5) {
                return json({ error: 'La nube tiene más datos que este teléfono.', motivo: 'tamano', nube: nPrev, telefono: nNuevo }, 409, cors);
              }
            }
          }
          const dia = new Date().toISOString().slice(0, 10);
          const meta = { httpMetadata: { contentType: 'application/json' } };
          const nuevo = await env.BUCKET.put('datos/actual.json', texto, meta);
          await env.BUCKET.put(`datos/dia/${dia}.json`, texto, meta);
          return json({ ok: true, etag: nuevo.etag, guardado: new Date().toISOString(), registros: registros(d) }, 200, cors);
        }
      }

      if (ruta === '/fotos' && req.method === 'GET') {
        const fotos = [];
        let cursor;
        do {
          const r = await env.BUCKET.list({ prefix: 'fotos/', cursor, include: ['customMetadata'] });
          for (const o of r.objects) {
            fotos.push({ id: o.key.slice(6), bytes: o.size, ts: Number((o.customMetadata || {}).ts || 0) });
          }
          cursor = r.truncated ? r.cursor : undefined;
        } while (cursor);
        return json({ fotos }, 200, cors);
      }

      const m = ruta.match(/^\/fotos\/([^/]+)$/);
      if (m) {
        const id = m[1];
        if (!FECHA.test(id)) return json({ error: 'Id de foto inválido' }, 400, cors);
        const key = 'fotos/' + id;
        if (req.method === 'GET') {
          const obj = await env.BUCKET.get(key);
          if (!obj) return json({ error: 'No existe' }, 404, cors);
          const cm = obj.customMetadata || {};
          return new Response(obj.body, {
            headers: {
              ...cors,
              'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg',
              'Cache-Control': 'no-store',
              'X-Foto-W': cm.w || '', 'X-Foto-H': cm.h || '', 'X-Foto-Ts': cm.ts || '',
              'Access-Control-Expose-Headers': 'X-Foto-W, X-Foto-H, X-Foto-Ts',
            },
          });
        }
        if (req.method === 'PUT') {
          const tipo = req.headers.get('Content-Type') || '';
          if (!tipo.startsWith('image/')) return json({ error: 'Solo imágenes' }, 415, cors);
          const buf = await leerLimitado(req, MAX_FOTO);
          if (!buf) return json({ error: 'Foto demasiado grande' }, 413, cors);
          const p = url.searchParams;
          const num = (x) => String(Number(x) || 0);
          await env.BUCKET.put(key, buf, {
            httpMetadata: { contentType: tipo },
            customMetadata: { w: num(p.get('w')), h: num(p.get('h')), ts: num(p.get('ts')) },
          });
          return json({ ok: true }, 200, cors);
        }
        if (req.method === 'DELETE') {
          await env.BUCKET.delete(key);
          return json({ ok: true }, 200, cors);
        }
      }

      return json({ error: 'No encontrado' }, 404, cors);
    } catch (e) {
      return json({ error: 'Error interno' }, 500, cors);
    }
  },
};
