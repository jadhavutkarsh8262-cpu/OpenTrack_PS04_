import json, shutil, subprocess, time
from .. import config as cfg

def render(scenes, title):
    npx = shutil.which("npx")
    if not npx or not (cfg.REMOTION_DIR / "node_modules").exists():
        return {"error": "Remotion not installed. Run `npm install` inside /remotion."}
    out = cfg.EXPORTS / f"explainer_{int(time.time())}.mp4"
    props = cfg.EXPORTS / "props.json"
    props.write_text(json.dumps({"title": title, "scenes": scenes}, ensure_ascii=False), encoding="utf-8")
    p = subprocess.run([npx, "remotion", "render", "src/index.ts", "Explainer", str(out), f"--props={props}"],
                       cwd=cfg.REMOTION_DIR, capture_output=True, text=True, timeout=900, shell=True)
    return {"download": f"/api/exports/{out.name}"} if p.returncode == 0 else {"error": p.stderr[-600:] or "Remotion render failed."}
