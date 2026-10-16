import json, re
from .. import config as cfg

def ask(prompt, system="Reply with valid JSON only."):
    """Call the LLM API (key stays on the server). Returns parsed JSON or None."""
    if not cfg.ANTHROPIC_API_KEY: return None
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=90,
            headers={"x-api-key": cfg.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={"model": cfg.LLM_MODEL, "max_tokens": 1500, "system": system,
                  "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        m = re.search(r"[\[{].*[\]}]", r.json()["content"][0]["text"], re.S)
        return json.loads(m.group(0)) if m else None
    except Exception:
        return None

def fix_words(words):
    """LLM corrects mis-heard tech terms / Hinglish; edits words in place so timestamps stay intact."""
    idx = " ".join(f"{i}:{w['w']}" for i, w in enumerate(words[:1500]))
    out = ask("Hinglish coding-class transcript as index:word. Return JSON [[index, corrected_word],...] "
              "only for mis-heard technical terms (glossary: " + ", ".join(cfg.GLOSSARY) + ") or Roman-script spelling errors.\n" + idx)
    for pair in (out if isinstance(out, list) else []):
        try: words[int(pair[0])]["w"] = str(pair[1])
        except Exception: pass
    return words

def rate_clips(texts):
    out = ask("Rate each clip 0-1: self-contained, one clear idea, engaging hook. Return a JSON list of numbers.\n" + json.dumps(texts))
    if isinstance(out, list) and len(out) == len(texts):
        try:
            return [float(x) for x in out]
        except Exception:
            pass
    return [0.5] * len(texts)

def script(topic):
    out = ask(f'Write a 45-second explainer on "{topic}" as JSON list of 4 scenes: '
              '[{"title":"","narration":"","code":""}]. Narration max 25 words, code max 6 short lines.')
    if isinstance(out, list) and out: return {"mode": "llm", "scenes": out}
    return {"mode": "template-demo", "scenes": [
        {"title": "Hook", "narration": f"Let's understand {topic} in under a minute.", "code": f"// {topic}"},
        {"title": "Core idea", "narration": f"Start with the main idea behind {topic}.", "code": "const idea = 'simple';"},
        {"title": "Example", "narration": "Walk through one small example step by step.", "code": "console.log(idea);"},
        {"title": "Recap", "narration": "Understand it, then practise it.", "code": "// practise!"}]}
