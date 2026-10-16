import cv2, numpy as np

def simplify_pts(pts, max_pts=16, min_dist=20):
    if len(pts) <= 2:
        return pts
    res = [pts[0]]
    for p in pts[1:-1]:
        prev = res[-1]
        dist = ((p[1] - prev[1])**2 + (p[2] - prev[2])**2)**0.5
        if dist >= min_dist:
            res.append(p)
    res.append(pts[-1])
    if len(res) > max_pts:
        indices = np.linspace(0, len(res) - 1, max_pts, dtype=int)
        res = [res[i] for i in indices]
    return res

def crop_path(path, start, end, step=2.0):
    cap = cv2.VideoCapture(str(path))
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if W <= 0 or H <= 0:
        W, H = 1920, 1080
    ch = max(2, int(H * 0.75) // 2 * 2)
    cw = max(2, min(W, int(ch * 9 / 16)) // 2 * 2)
    cx, cy, prev, pts, t = W / 2, H / 2, None, [], start
    while t <= end:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000); ok, f = cap.read()
        if not ok: break
        g = cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (9, 9), 0)
        if prev is not None:
            ys, xs = np.where(cv2.absdiff(g, prev) > 25)
            if len(xs) > 30: cx = .7 * cx + .3 * np.median(xs); cy = .7 * cy + .3 * np.median(ys)  # smooth glide
        prev = g
        pts.append((round(t - start, 2), int(min(max(cx - cw / 2, 0), W - cw)), int(min(max(cy - ch / 2, 0), H - ch))))
        t += step
    cap.release()
    clean_pts = simplify_pts(pts or [(0, 0, 0)])
    return cw, ch, clean_pts

def expr(pts, k):  # piecewise-linear FFmpeg expression of time t
    if not pts: return "0"
    if len(pts) == 1: return str(pts[0][k])
    e = str(pts[-1][k])
    for p, q in reversed(list(zip(pts, pts[1:]))):
        dt = q[0] - p[0]
        if dt > 0.001:
            e = f"if(lt(t,{q[0]}),{p[k]}+({q[k]}-{p[k]})*(t-{p[0]})/{dt:.2f},{e})"
    return e
