import json, re, httpx
from .. import config as cfg

def get_active_provider():
    if cfg.GEMINI_API_KEY: return "gemini"
    if cfg.GROQ_API_KEY: return "groq"
    if cfg.OPENAI_API_KEY: return "openai"
    if cfg.ANTHROPIC_API_KEY: return "anthropic"
    return "offline"

def ask(prompt, system="Reply with valid JSON only."):
    """Call the LLM API (Gemini, Groq, Anthropic, or OpenAI). Server-side only; returns parsed JSON or None."""
    # 1. Google Gemini
    if cfg.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={cfg.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": f"System: {system}\n\nUser: {prompt}"}]}],
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
            }
            r = httpx.post(url, timeout=60, json=payload)
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            m = re.search(r"[\[{].*[\]}]", text, re.S)
            if m: return json.loads(m.group(0))
        except Exception as e:
            print(f"Gemini API warning: {e}")

    # 2. Groq
    if cfg.GROQ_API_KEY:
        try:
            r = httpx.post("https://api.groq.com/openai/v1/chat/completions", timeout=60,
                headers={"Authorization": f"Bearer {cfg.GROQ_API_KEY}"},
                json={"model": "llama-3.3-70b-versatile", "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ], "temperature": 0.2})
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"]
            m = re.search(r"[\[{].*[\]}]", text, re.S)
            if m: return json.loads(m.group(0))
        except Exception as e:
            print(f"Groq API warning: {e}")

    # 3. Anthropic Claude
    if cfg.ANTHROPIC_API_KEY:
        try:
            model = cfg.LLM_MODEL if "claude" in cfg.LLM_MODEL else "claude-3-5-sonnet-20241022"
            r = httpx.post("https://api.anthropic.com/v1/messages", timeout=90,
                headers={"x-api-key": cfg.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
                json={"model": model, "max_tokens": 1500, "system": system,
                      "messages": [{"role": "user", "content": prompt}]})
            r.raise_for_status()
            m = re.search(r"[\[{].*[\]}]", r.json()["content"][0]["text"], re.S)
            if m: return json.loads(m.group(0))
        except Exception as e:
            print(f"Anthropic API warning: {e}")

    # 4. OpenAI
    if cfg.OPENAI_API_KEY:
        try:
            r = httpx.post("https://api.openai.com/v1/chat/completions", timeout=90,
                headers={"Authorization": f"Bearer {cfg.OPENAI_API_KEY}"},
                json={"model": "gpt-4o-mini", "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ], "temperature": 0.3})
            r.raise_for_status()
            m = re.search(r"[\[{].*[\]}]", r.json()["choices"][0]["message"]["content"], re.S)
            if m: return json.loads(m.group(0))
        except Exception as e:
            print(f"OpenAI API warning: {e}")

    return None

def fix_words(words):
    """LLM or smart glossary corrects mis-heard tech terms and Roman-script Hinglish."""
    if not words:
        return words
    idx = " ".join(f"{i}:{w['w']}" for i, w in enumerate(words[:1500]))
    out = ask("Hinglish coding-class transcript as index:word. Return JSON [[index, corrected_word],...] "
              "only for mis-heard technical terms (glossary: " + ", ".join(cfg.GLOSSARY[:25]) + ") or Roman-script spelling errors.\n" + idx)
    if isinstance(out, list):
        for pair in out:
            try:
                words[int(pair[0])]["w"] = str(pair[1])
            except Exception:
                pass
    return words

def rate_clips(texts):
    """Rate candidate clips 0.0-1.0 based on hook strength, conceptual clarity, and completeness."""
    if not texts:
        return []
    out = ask("Rate each clip 0-1 for a short vertical educational reel: self-contained, one clear coding idea, engaging hook. Return a JSON list of numbers.\n" + json.dumps(texts))
    if isinstance(out, list) and len(out) == len(texts):
        try:
            return [float(x) for x in out]
        except Exception:
            pass
    # Heuristic scoring fallback based on tech terms and punctuation
    scores = []
    glossary_low = {g.lower() for g in cfg.GLOSSARY}
    for t in texts:
        words = t.split()
        term_hits = sum(1 for w in words if w.lower().strip(".,?!") in glossary_low)
        score = 0.5 + min(0.4, term_hits * 0.1)
        if any(h in t.lower() for h in ["let's", "how to", "why", "difference", "important", "remember", "dhyan rakhna"]):
            score = min(0.95, score + 0.1)
        scores.append(round(score, 2))
    return scores

def script(topic):
    """Generate a high-impact 4-scene technical explainer reel script with narration and code."""
    topic_clean = topic.strip()
    out = ask(
        f'Write a 45-second vertical reel explainer on "{topic_clean}" as a JSON list of 4 scenes: '
        '[{"title":"Hook / Concept","narration":"Crisp 15-20 words spoken narration","code":"3-5 lines code"}]. '
        'Keep narration punchy and natural. Return JSON array only.'
    )
    if isinstance(out, list) and len(out) >= 3:
        return {"mode": "llm", "scenes": out}

    # Rich dynamic educational templates
    top_lower = topic_clean.lower()
    if "async" in top_lower or "await" in top_lower:
        scenes = [
            {"title": "The Async Problem", "narration": f"Synchronous code blocks your entire app while waiting. Here's how {topic_clean} solves it.", "code": "# Blocking code halts execution\nimport time\ntime.sleep(2) # freeze!"},
            {"title": "Non-blocking Await", "narration": "With async and await, Python frees the event loop while waiting for I/O tasks.", "code": "import asyncio\nasync def fetch():\n    await asyncio.sleep(2)\n    return 'Done!'"},
            {"title": "Running Concurrent Tasks", "narration": "Run multiple network requests concurrently using asyncio gather.", "code": "async def main():\n    results = await asyncio.gather(\n        fetch(), fetch()\n    )\n    print(results)"},
            {"title": "Key Takeaway", "narration": "Use async for network, file, and database operations to keep your server blazing fast.", "code": "# asyncio.run(main())\n# Blazing fast concurrent I/O"}
        ]
    elif "react" in top_lower or "hook" in top_lower or "effect" in top_lower or "state" in top_lower:
        scenes = [
            {"title": "State vs Effect", "narration": f"Understanding {topic_clean} is essential for building responsive React applications.", "code": "import { useState, useEffect } from 'react';\n\nfunction Counter() {"},
            {"title": "State Holds Data", "narration": "useState stores values that trigger a clean component re-render when updated.", "code": "  const [count, setCount] = useState(0);\n  // triggers re-render on update"},
            {"title": "Effects Handle Side-Effects", "narration": "useEffect synchronizes with external systems like API fetches or subscriptions.", "code": "  useEffect(() => {\n    document.title = `Count: ${count}`;\n  }, [count]);"},
            {"title": "Summary", "narration": "Keep state minimal, and use dependency arrays carefully to avoid infinite loops.", "code": "  return <button onClick={() => setCount(c => c + 1)}>+1</button>;\n}"}
        ]
    elif "docker" in top_lower or "container" in top_lower:
        scenes = [
            {"title": "Why Docker?", "narration": "Tired of 'it works on my machine'? Docker packages your app with all its dependencies.", "code": "# Standard reproducible environment\nFROM python:3.11-slim\nWORKDIR /app"},
            {"title": "Building the Image", "narration": "Copy your requirements, install packages, and isolate your application code.", "code": "COPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . ."},
            {"title": "Running the Container", "narration": "Expose your service port and define the entry command.", "code": "EXPOSE 8000\nCMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\"]"},
            {"title": "Pro Tip", "narration": "Use multi-stage builds and minimal base images to shrink production image sizes.", "code": "$ docker build -t app:latest .\n$ docker run -p 8000:8000 app"}
        ]
    else:
        scenes = [
            {"title": f"Understanding {topic_clean}", "narration": f"Let's break down {topic_clean} in under 45 seconds with practical code.", "code": f"// Overview of {topic_clean}\n// Clean modern implementation"},
            {"title": "Core Mechanism", "narration": f"Here is the foundational syntax you need to use {topic_clean} effectively.", "code": f"function setupConcept() {{\n  const core = '{topic_clean}';\n  return init(core);\n}}"},
            {"title": "Practical Example", "narration": "Watch how this works in real production code step by step.", "code": "const result = setupConcept();\nif (result.isValid) {\n  console.log('Success:', result);\n}"},
            {"title": "Best Practices", "narration": f"Remember to keep functions modular, handle edge cases, and test {topic_clean} thoroughly.", "code": "// Pro Tip: Profile performance\nexport default setupConcept;"}
        ]
    return {"mode": "smart-template", "scenes": scenes}
