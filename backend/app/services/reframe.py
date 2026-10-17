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

def ocr_code_center(gray_frame):
    """Detect bounding boxes of code keywords using pytesseract OCR if available."""
    try:
        import pytesseract
        # Quick OCR detection of code keywords
        data = pytesseract.image_to_data(gray_frame, output_type=pytesseract.Output.DICT)
        code_words = {"def", "class", "function", "import", "const", "let", "return", "public", "void", "async", "await", "from"}
        xs, ys = [], []
        for i, text in enumerate(data.get("text", [])):
            if text.strip().lower() in code_words:
                xs.append(data["left"][i] + data["width"][i] / 2.0)
                ys.append(data["top"][i] + data["height"][i] / 2.0)
        if xs and ys:
            return float(np.median(xs)), float(np.median(ys))
    except Exception:
        pass
    return None

def text_center(gray_frame):
    """Detect active code/text regions on screen using OpenCV morphological gradient."""
    # First attempt OCR if keyword density is high
    ocr_pt = ocr_code_center(gray_frame)
    if ocr_pt is not None:
        return ocr_pt

    try:
        grad = cv2.Sobel(gray_frame, cv2.CV_8U, 1, 0, ksize=3)
        _, thresh = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 5))
        connected = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        cnts, _ = cv2.findContours(connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if cnts:
            valid = [cv2.boundingRect(c) for c in cnts if cv2.contourArea(c) > 250]
            if valid:
                all_x = [x + w / 2 for x, y, w, h in valid]
                all_y = [y + h / 2 for x, y, w, h in valid]
                return float(np.median(all_x)), float(np.median(all_y))
    except Exception:
        pass
    return None

def crop_path(path, start, end, step=2.0, mode="smart"):
    """Calculate 9:16 crop window trajectory over time with smart motion tracking or anchored modes."""
    cap = cv2.VideoCapture(str(path))
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if W <= 0 or H <= 0:
        W, H = 1920, 1080

    # Strict 9:16 vertical aspect ratio
    ch = H if H % 2 == 0 else H - 1
    cw = int(ch * 9 / 16)
    if cw % 2 != 0: cw -= 1
    if cw > W:
        cw = W if W % 2 == 0 else W - 1
        ch = int(cw * 16 / 9)
        if ch % 2 != 0: ch -= 1

    # Static anchor modes
    if mode == "center":
        x = (W - cw) // 2
        y = (H - ch) // 2
        cap.release()
        return cw, ch, [(0.0, x, y), (round(end - start, 2), x, y)]

    if mode == "left":
        x = 0
        y = (H - ch) // 2
        cap.release()
        return cw, ch, [(0.0, x, y), (round(end - start, 2), x, y)]

    if mode == "right":
        x = max(0, W - cw)
        y = (H - ch) // 2
        cap.release()
        return cw, ch, [(0.0, x, y), (round(end - start, 2), x, y)]

    # Dynamic Smart Tracking
    cx, cy, prev, pts, t = W / 2.0, H / 2.0, None, [], start
    while t <= end:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ok, f = cap.read()
        if not ok: break
        g = cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (9, 9), 0)
        tc = text_center(g)
        if tc is not None:
            cx = 0.65 * cx + 0.35 * tc[0]
            cy = 0.65 * cy + 0.35 * tc[1]
        if prev is not None:
            diff = cv2.absdiff(g, prev)
            ys, xs = np.where(diff > 25)
            if len(xs) > 40:
                cx = 0.75 * cx + 0.25 * float(np.median(xs))
                cy = 0.75 * cy + 0.25 * float(np.median(ys))
        prev = g
        pts.append((
            round(t - start, 2),
            int(min(max(cx - cw / 2.0, 0), W - cw)),
            int(min(max(cy - ch / 2.0, 0), H - ch))
        ))
        t += step
    cap.release()
    clean_pts = simplify_pts(pts or [(0.0, (W - cw) // 2, (H - ch) // 2)])
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
