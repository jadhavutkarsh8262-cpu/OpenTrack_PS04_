import {AbsoluteFill, Sequence, useCurrentFrame, interpolate} from "remotion";

type Scene = {title: string; narration: string; code: string};

const CodeWindow = ({code}: {code?: string}) => {
  const f = useCurrentFrame();
  const c = code || "";
  const charsShown = Math.floor(f / 1.4);
  const text = c.slice(0, charsShown);

  return (
    <div style={{
      background: "#181524",
      borderRadius: 24,
      marginTop: 48,
      border: "1px solid rgba(255, 255, 255, 0.12)",
      boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7)",
      overflow: "hidden"
    }}>
      {/* Window Titlebar */}
      <div style={{
        background: "#100e1a",
        padding: "18px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
      }}>
        <div style={{width: 16, height: 16, borderRadius: "50%", background: "#ff5f56"}} />
        <div style={{width: 16, height: 16, borderRadius: "50%", background: "#ffbd2e"}} />
        <div style={{width: 16, height: 16, borderRadius: "50%", background: "#27c93f"}} />
        <span style={{marginLeft: 16, color: "#8b85a1", fontSize: 22, fontFamily: "monospace"}}>
          demo.py
        </span>
      </div>

      {/* Code Area */}
      <pre style={{
        margin: 0,
        padding: "36px 36px 48px",
        color: "#9be3b5",
        fontSize: 38,
        lineHeight: 1.5,
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}>
        {text}
        <span style={{color: "#e5bf70", opacity: f % 16 < 8 ? 1 : 0}}>▌</span>
      </pre>
    </div>
  );
};

const Caption = ({text, per}: {text?: string; per: number}) => {
  const f = useCurrentFrame();
  const t = text || "";
  const w = t.split(" ").filter(Boolean);
  if (w.length === 0) return null;

  const wordDuration = Math.max(1, per / w.length);
  const cur = Math.min(w.length - 1, Math.floor(f / wordDuration));

  return (
    <div style={{
      position: "absolute",
      bottom: 180,
      left: 60,
      right: 60,
      padding: "24px 32px",
      borderRadius: 20,
      background: "rgba(10, 8, 18, 0.85)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.4,
      textAlign: "center"
    }}>
      {w.map((x, i) => (
        <span
          key={i}
          style={{
            color: i === cur ? "#e5bf70" : i < cur ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            textShadow: i === cur ? "0 0 16px rgba(229, 191, 112, 0.6)" : "none",
            transition: "all 0.1s ease"
          }}
        >
          {x}{" "}
        </span>
      ))}
    </div>
  );
};

export const Explainer = ({title, scenes}: {title?: string; scenes?: Scene[]}) => {
  const sc = Array.isArray(scenes) && scenes.length > 0 ? scenes : [
    {title: title || "Explainer", narration: "Welcome to this concept explainer.", code: "// code demo"}
  ];
  const per = Math.max(30, Math.floor(1350 / sc.length));

  return (
    <AbsoluteFill style={{
      background: "radial-gradient(circle at 50% 20%, #1e1933 0%, #0d0b17 100%)",
      color: "#fff",
      fontFamily: "'Outfit', -apple-system, sans-serif",
      padding: "90px 60px 60px"
    }}>
      {/* Top Header Badge */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        alignSelf: "flex-start",
        background: "rgba(229, 191, 112, 0.12)",
        border: "1px solid rgba(229, 191, 112, 0.3)",
        borderRadius: 9999,
        padding: "10px 24px",
        marginBottom: 20
      }}>
        <span style={{fontSize: 24}}>⚡</span>
        <span style={{color: "#e5bf70", fontSize: 24, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase"}}>
          {title || "Dev Explainer"}
        </span>
      </div>

      {sc.map((s, i) => (
        <Sequence key={i} from={i * per} durationInFrames={per}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16
          }}>
            <span style={{
              background: "rgba(139, 92, 246, 0.25)",
              color: "#c4b5fd",
              fontSize: 22,
              fontWeight: 800,
              padding: "4px 14px",
              borderRadius: 8
            }}>
              Scene {i + 1}
            </span>
            <h1 style={{color: "#ffffff", fontSize: 62, fontWeight: 800, margin: 0}}>
              {s.title}
            </h1>
          </div>

          <CodeWindow code={s.code} />
          <Caption text={s.narration} per={per} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
