"""Despliega el respaldo en la nube de HOD GYM: bucket R2 + Worker hod-gym-api.

Uso:  python nube/desplegar.py

Lee el token de Cloudflare de ~/.config/hod-gym/cf_token (o de la variable CF_TOKEN)
y la clave de la app de ~/.config/hod-gym/clave.txt (si no existe, la crea).
Nada de eso vive en el repo, que es público.
"""
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

CUENTA = "0396e4697227062d2156d1a94117ee7a"
BUCKET = "hod-gym"
WORKER = "hod-gym-api"
API = "https://api.cloudflare.com/client/v4"
CONF = Path.home() / ".config" / "hod-gym"
AQUI = Path(__file__).resolve().parent


def token():
    t = os.environ.get("CF_TOKEN") or (CONF / "cf_token").read_text().strip()
    if not t:
        sys.exit("Falta el token de Cloudflare")
    return t


def clave():
    f = CONF / "clave.txt"
    if f.exists():
        return f.read_text().strip()
    CONF.mkdir(parents=True, exist_ok=True)
    k = secrets.token_urlsafe(32)
    f.write_text(k)
    print("Clave nueva creada en", f)
    return k


def llamar(metodo, ruta, tok, cuerpo=None, tipo="application/json"):
    data = cuerpo if isinstance(cuerpo, (bytes, type(None))) else json.dumps(cuerpo).encode()
    req = urllib.request.Request(API + ruta, data=data, method=metodo,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": tipo})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except Exception:
            return {"success": False, "errors": [{"code": e.code, "message": e.reason}]}


def ok(r, que):
    if not r.get("success"):
        sys.exit(f"Falló {que}: {r.get('errors')}")
    return r.get("result")


def main():
    tok = token()
    k = clave()

    # 1. Bucket privado
    bs = ok(llamar("GET", f"/accounts/{CUENTA}/r2/buckets", tok), "listar buckets")
    if BUCKET not in [b["name"] for b in bs.get("buckets", [])]:
        ok(llamar("POST", f"/accounts/{CUENTA}/r2/buckets", tok, {"name": BUCKET}), "crear bucket")
        print("Bucket creado:", BUCKET)
    else:
        print("Bucket ya existe:", BUCKET)

    # 2. Worker con el bucket y la clave como secreto
    meta = {
        "main_module": "worker.js",
        "compatibility_date": "2026-09-01",
        "bindings": [
            {"type": "r2_bucket", "name": "BUCKET", "bucket_name": BUCKET},
            {"type": "secret_text", "name": "CLAVE", "text": k},
        ],
    }
    frontera = uuid.uuid4().hex
    partes = [
        f'--{frontera}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode()
        + json.dumps(meta).encode() + b"\r\n",
        f'--{frontera}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n'.encode()
        + (AQUI / "worker.js").read_bytes() + b"\r\n",
        f"--{frontera}--\r\n".encode(),
    ]
    ok(llamar("PUT", f"/accounts/{CUENTA}/workers/scripts/{WORKER}", tok, b"".join(partes),
              f"multipart/form-data; boundary={frontera}"), "subir worker")
    print("Worker subido:", WORKER)

    # 3. Dirección pública en workers.dev
    ok(llamar("POST", f"/accounts/{CUENTA}/workers/scripts/{WORKER}/subdomain", tok,
              {"enabled": True, "previews_enabled": False}), "activar workers.dev")
    sub = ok(llamar("GET", f"/accounts/{CUENTA}/workers/subdomain", tok), "leer subdominio")["subdomain"]
    print("URL:", f"https://{WORKER}.{sub}.workers.dev")


if __name__ == "__main__":
    main()
