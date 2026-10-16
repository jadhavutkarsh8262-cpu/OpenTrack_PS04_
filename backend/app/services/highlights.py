import re, subprocess
import numpy as np
from . import llm

def duration(path):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                           capture_output=True, text=True, timeout=30)
        return float(r.stdout.strip())
    except Exception: return 0.0

def sentences(words):
    out, cur = [], []
    for w in words:
        if cur and w["s"] - cur[-1]["e"] > 0.6: out.append(cur); cur = []
        cur.append(w)
        if w["w"].endswith((".", "?", "!", "।")): out.append(cur); cur = []
    if cur: out.append(cur)
    return out

def energy(path):  # voice loudness (RMS) per second
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                         capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(float); n = len(a) // 8000
    return np.sqrt((a[:n * 8000].reshape(n, 8000) ** 2).mean(1)) if n else np.zeros(1)

def scene_times(path):  # screen-change timestamps from FFmpeg scene detection
    r = subprocess.run(["ffmpeg", "-i", str(path), "-vf", "select='gt(scene,0.02)',showinfo", "-f", "null", "-"],
                       capture_output=True, text=True)
    return [float(x) for x in re.findall(r"pts_time:([\d.]+)", r.stderr)]

def find_clips(path, words, n=3):
    S = sentences(words); en = energy(path); sc = scene_times(path); cands = []
    for i in range(len(S)):                       # clips are built from whole sentences => no mid-sentence cuts
        for j in range(i, len(S)):
            s, e = S[i][0]["s"], S[j][-1]["e"]
            if e - s > 60: break
            if e - s >= 30: cands.append((s, e, i, j)); break
    if not cands: return []
    raw = []
    for s, e, _, _ in cands:
        seg = en[int(s):int(e) + 1]
        raw.append((float(seg.mean()) if len(seg) else 0, sum(s <= t <= e for t in sc) / max(e - s, 1)))
    mx = [max(r[k] for r in raw) or 1 for k in (0, 1)]
    base = [0.5 * r[0] / mx[0] + 0.5 * r[1] / mx[1] for r in raw]
    top = sorted(range(len(cands)), key=lambda k: -base[k])[:10]
    texts = [" ".join(w["w"] for a in S[cands[k][2]:cands[k][3] + 1] for w in a) for k in top]
    rated = sorted(zip(top, llm.rate_clips(texts)), key=lambda t: -(0.4 * base[t[0]] + 0.6 * t[1]))
    chosen = []
    for k, l in rated:
        s, e = cands[k][:2]
        if all(e <= c["start"] or s >= c["end"] for c in chosen):
            chosen.append({"start": round(s, 2), "end": round(e, 2), "title": f"Highlight {len(chosen) + 1}",
                           "score": round(0.4 * base[k] + 0.6 * l, 2),
                           "reason": "Sentence-aligned; scored on transcript (LLM), voice energy, screen change."})
        if len(chosen) == n: break
    return chosen
