"""Prepare only public site assets; inject the browser map key at deployment."""
import json
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
key = os.environ.get("CARTO_BASEMAP_API_KEY", "").strip()
if not key:
    raise SystemExit("Missing CARTO_BASEMAP_API_KEY")

output = ROOT / "_site"
if output.exists():
    shutil.rmtree(output)
output.mkdir()
for name in ("index.html", "styles.css", "app.js", "sw.js", ".nojekyll"):
    shutil.copy2(ROOT / name, output / name)
for name in ("assets", "data"):
    shutil.copytree(ROOT / name, output / name)
(output / "config.js").write_text(
    "window.CONALUNCH_CONFIG = " + json.dumps({"cartoBasemapApiKey": key}) + ";\n",
    encoding="utf-8",
)
print("Static site prepared in _site/")
