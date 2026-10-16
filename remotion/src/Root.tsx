import {Composition} from "remotion";
import {Explainer} from "./Explainer";
export const Root = () => (
  <Composition id="Explainer" component={Explainer} width={1080} height={1920} fps={30} durationInFrames={1350}
    defaultProps={{title: "JSON vs XML", scenes: [{title: "Demo", narration: "Hello from Remotion", code: "const a = 1;"}]}} />
);
