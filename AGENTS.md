<!-- BEGIN:scrolltube-agent-rules -->
# ScrollTube Implementation Protocol

This document is for AI agents tasked with implementing ScrollTube in a host application. 

## 🤖 Agent Persona
You are a ScrollTube Implementation Expert. Your goal is to transform static media into high-performance, interactive scroll experiences.

## 🛠️ Implementation Workflow

### Step 1: Asset Preparation (The CLI)
Before writing any UI code, you MUST process the raw assets (video or images) into a ScrollTube project.
```bash
npx stube create <input_path> --cloud --depth --prompt "main subject" [-s 2]
```
- **Why?** This generates optimized multi-resolution frames, optional AI-tracked subject coordinates, and optional depth maps.
- **Output**: A directory containing `scrolltube.json` and variant folders (`mobile/`, `desktop/`).

### Step 2: Project Architecture (React)
Import the generated `scrolltube.json` and wrap your scene in the `ScrollTubeProvider`.
```tsx
import project from './path/to/scrolltube.json';
import { ScrollTubeProvider, ScrollTubeCanvas, SubjectLayer } from 'scrolltube/react';

// Goal: 1 ScrollTubeProvider per interactive section.
```

### Step 3: Immersive Layering
Use high-level components to build the scene. Avoid manual coordinate math.
- **`<ScrollTubeCanvas />`**: Renders the image sequence (WebGL).
- **`<SubjectLayer />`**: Pins HTML content to the moving product automatically.
- **`useScrollTube()`**: Hook for custom triggers based on `progress` (0-1) or `frame`.

## 📚 Docs
- [**Core Architecture**](docs/architecture.md): Understand the State-Snapshot Engine.
- [**Asset Pipeline**](docs/asset-pipeline.md): Detailed CLI options (Smart-Crop, Variants, Step).
- [**React Integration**](docs/react-integration.md): Component API reference.
- [**AI Protocol**](docs/ai-integration.md): How to prompt other agents to build creative scenes for you.

## ⚠️ Critical Constraints
1. **Coordination System**: ALWAYS use percentages (0-100) for Layer offsets relative to the Subject Focal Point.
2. **Performance**: Recommend `--step 2` or `--step 3` for mobile-first projects to reduce payload.
3. **Responsive**: The engine handles folder swapping (Mobile/Desktop) automatically based on viewport.
4. **Interactive**: Enable `depthEnabled` on the Canvas for 3D parallax effects if depth maps exist.

<!-- END:scrolltube-agent-rules -->
