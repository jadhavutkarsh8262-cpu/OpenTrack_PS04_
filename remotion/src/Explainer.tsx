import {AbsoluteFill, Sequence, useCurrentFrame} from "remotion";
type Scene = {title: string; narration: string; code: string};
const Typed = ({code}: {code?: string}) => {
  const f = useCurrentFrame();
  const c = code || "";
  return <pre style={{background: "#1c1926", color: "#9be3b5", fontSize: 40, padding: 40, borderRadius: 20, marginTop: 40, whiteSpace: "pre-wrap", wordBreak: "break-word"}}>
    {c.slice(0, Math.floor(f / 1.5))}▌</pre>;
};
const Caption = ({text, per}: {text?: string; per: number}) => {
  const f = useCurrentFrame();
  const t = text || "";
  const w = t.split(" ").filter(Boolean);
  if (w.length === 0) return null;
  const wordDuration = Math.max(1, per / w.length);
  const cur = Math.min(w.length - 1, Math.floor(f / wordDuration));
  return <div style={{position: "absolute", bottom: 200, left: 60, right: 60, fontSize: 52, fontWeight: 700}}>
    {w.map((x, i) => <span key={i} style={{color: i === cur ? "#d8b45a" : "#fff"}}>{x} </span>)}</div>;
};
export const Explainer = ({title, scenes}: {title?: string; scenes?: Scene[]}) => {
  const sc = Array.isArray(scenes) && scenes.length > 0 ? scenes : [
    {title: title || "Explainer", narration: "Welcome to this concept explainer.", code: "// code demo"}
  ];
  const per = Math.max(30, Math.floor(1350 / sc.length));
  return <AbsoluteFill style={{background: "#111019", color: "#fff", fontFamily: "sans-serif", padding: 60}}>
    {sc.map((s, i) => <Sequence key={i} from={i * per} durationInFrames={per}>
      <h1 style={{color: "#d8b45a", fontSize: 70}}>{s.title}</h1><Typed code={s.code} /><Caption text={s.narration} per={per} />
    </Sequence>)}
  </AbsoluteFill>;
};
