# AI Agent Workflow

ScrollTube is built for **Agent-Led Development**. The goal is to move from "writing code" to "orchestrating workflows."

## 1. The Two-Phase Workflow

For an AI to successfully build an experience, it must follow these two phases:

### Phase A: Asset Intelligence (CLI Execution)
The agent should first use the CLI to process raw media into an intelligent ScrollTube project.
```bash
# Example: Process a video with AI tracking and depth maps
npx scrolltube create input.mp4 --name "my-project" --track "main product" --cloud --depth

```
**Output:** A directory containing optimized frames, depth maps in variants for specific resolutions and a `scrolltube.json` file and a copy of the source - raw media.

### Phase B: Immersive Implementation (React)
The agent then uses the generated JSON to build the UI components.

```tsx
import project from './scrolltube-project/scrolltube.json';
import { ScrollTubeProvider, ScrollTubeCanvas, SubjectLayer } from 'scrolltube/react';

export const MyExperience = () => (
  <ScrollTubeProvider project={project} scrub={0.1}>
    <div style={{ height: '300vh' }}>
      <div style={{ sticky: 'top-0', height: '100vh' }}>
        <ScrollTubeCanvas />
        
        {/* Pins content to the tracked subject automatically */}
        <SubjectLayer offset={{ x: 10, y: -5 }}>
          <div className="info-box">
            Hello From ScrollTube
          </div>
        </SubjectLayer>
      </div>
    </div>
  </ScrollTubeProvider>
);
```

## 2. Protocol for AI Agents (Claude/GPT)

Paste this into your chat to turn an AI into a ScrollTube specialist:

```markdown
You are the ScrollTube Implementation Specialist. Your goal is to design immersive scroll experiences.

Workflow:
1. CLI FIRST: Start by suggesting `npx scrolltube create` to process assets.

2. ENGINE AWARE: Use 'ScrollTubeProvider' to sync the engine with React state.
3. SUBJECT PINS: Use 'SubjectLayer' to attach UI to the product coordinates found by the AI tracker.
4. DYNAMIC UI: Use the 'progress' (0-1) or 'frame' count from 'useScrollTube' for custom triggers.

Guiding Principles:
- Don't hardcode animations; let the ScrollTube engine handle interpolation.
- Use 'Subject-Relative' coordinates wherever possible for perfect pinning.
- For Mobile, consider centering text layers ABOVE or BELOW the subject focal point.
- For Desktop, place text layers to the SIDES of the subject focal point.

```

---

## 3. The "Intelligence-as-a-Service" Model

This workflow enables a powerful business model:
1. **The CLI** handles the "hard" computer vision (tracking, depth, optimization).
2. **The JSON** stores this intelligence.
3. **The AI Agent** uses that intelligence to write the perfectly synced creative layer.

You provide the **SDK**, the AI provides the **Implementation**.
yer.

You provide the **SDK**, the AI provides the **Implementation**.
yer.

You provide the **SDK**, the AI provides the **Implementation**.
