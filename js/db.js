// Envoltura mínima de IndexedDB con promesas. Todo vive en el teléfono.
const DB_NAME = 'fierro';
const VERSION = 1;
export const STORES = ['kv', 'sessions', 'weighins', 'photos', 'meals'];

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((d) => new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

export const db = {
  get: (s, k) => tx(s, 'readonly', (o) => o.get(k)),
  put: (s, k, v) => tx(s, 'readwrite', (o) => o.put(v, k)),
  del: (s, k) => tx(s, 'readwrite', (o) => o.delete(k)),
  all: (s) => tx(s, 'readonly', (o) => o.getAll()),
  keys: (s) => tx(s, 'readonly', (o) => o.getAllKeys()),
  clear: (s) => tx(s, 'readwrite', (o) => o.clear()),
};
