"""Despliegue de Fierro: sube la versión, hace commit y push a main (GitHub Pages).

Uso:  python deploy.py "mensaje del commit"
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION_JS = ROOT / "js" / "version.js"
SW = ROOT / "sw.js"


def bump(v):
    a, b, c = (int(x) for x in v.split("."))
    return f"{a}.{b}.{c + 1}"


def main():
    msg = sys.argv[1] if len(sys.argv) > 1 else "Actualización"
    txt = VERSION_JS.read_text(encoding="utf-8")
    cur = re.search(r"'(\d+\.\d+\.\d+)'", txt).group(1)
    new = bump(cur)
    VERSION_JS.write_text(txt.replace(cur, new), encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    SW.write_text(re.sub(r"const VERSION = '[^']+'", f"const VERSION = '{new}'", sw), encoding="utf-8")
    print(f"{cur} -> {new}")
    run = lambda *a: subprocess.run(a, cwd=ROOT, check=True)
    run("git", "add", "-A")
    run("git", "commit", "-m", f"{msg} (v{new})")
    run("git", "push", "origin", "main")
    print("Publicado. GitHub Pages tarda 1 a 2 minutos en servirlo.")


if __name__ == "__main__":
    main()
