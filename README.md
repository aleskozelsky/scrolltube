# ScrollTube 

**Transform media into interactive web experiences.**

ScrollTube is a modern animation SDK built for the era of high-performance, agent-driven development. It allows you to transform standard video or images into web assets that precisely track subjects and depth.

[scroll.tube](https://www.scroll.tube)

---

## Installation

```bash
npm install scrolltube
```

---

## The Universal Asset Pipeline

ScrollTube features a **Universal Asset Pipeline** that runs identical logic in both the **CLI** (Node.js) and the **Browser** (ideal for CMS integrations like WordPress).

### 1. Asset Pipeline
Asset pipeline is used to transform video or images into ScrollTube projects. It outputs a folder with optimized variants and a scrolltube.json file that you point to in your ScrollTubeProvider in step 2. You can use the pipeline in the CLI, browser or node.

#### CLI Usage (Node.js)
Transform your video into a ScrollTube project from your terminal:

```bash
# This will extract frames, track the subject, and generate optimized variants and depth maps.
npx stube create "your-video.mp4" --name "my-project" --track "apple" --cloud --depth
```

#### Programmatic Usage (Browser/Node)
You can also import the pipeline into your own React apps or dashboard:

```javascript
import { AssetPipeline } from 'scrolltube/pipeline';

const pipeline = new AssetPipeline({ 
  apiKey: process.env.SCROLLTUBE_KEY || process.env.FAL_KEY, 
  onProgress: (p) => console.log(`${p.step}: ${p.percent}%`)
});

// Returns the project configuration or a ZIP blob
const project = await pipeline.create({
  input: videoFile, // Can be a File object or Path
  name: "my-project",
  track: "apple",
  depth: true,
  variants: [720, 1080],
  outputZip: true // Perfect for CMS uploads
});
```

### 2. Rendering Integration

All you have to do now, is to drop the scrolltube.json project into your ScrollTubeProvider.

#### Vanilla JS Integration
For full implementation, please refer to the [Vanilla JS Example](https://github.com/aleskozelsky/scrolltube/blob/main/demos/html/index.html).

[Live Demo](https://demo-html.scroll.tube) 

```html
<!-- 2. Drop it into your HTML -->
<script type="module">
    import ScrollTube from 'scrolltube/core';

    document.addEventListener('DOMContentLoaded', async () => {
        const orchestrators = await ScrollTube.CoreOrchestrator.initAll();
    });
</script>
```


#### React Integration
For full implementation, please refer to the [React Integration Example](https://github.com/aleskozelsky/scrolltube/blob/main/demos/create-next-app/src/app/page.tsx).

[Live Demo](https://demo-nextjs.scroll.tube) 


```tsx
// 2. Drop it into your Next.js app
import myproject from './example-apple-project/scrolltube.json';
import { ScrollTubeProvider, ScrollTubeCanvas, ScrollTubeLayer, ScrollTubeLayerTracking, useScrollTube } from 'scrolltube/react';


const App = () => (
  <ScrollTubeProvider 
    project={myproject} 
  >
    <ScrollTubeLayer>
      <ScrollTubeCanvas />
    </ScrollTubeLayer>
      
    {/* Automatically follows the 'apple' tracked in the CLI */}
    <ScrollTubeLayerTracking id="main">
        <h2>Apple</h2>
    </ScrollTubeLayerTracking>

    {/* Shows frame number and animates opacity based on scroll progress */}
    <ScrollTubeLayer align="bottom-left">
        <AppleInfo />
    </ScrollTubeLayer>
  </ScrollTubeProvider>
);

const AppleInfo = () => {
    const { progress, frame } = useScrollTube();
    const opacity = progress > 0.2 && progress < 0.5 ? 1 : 0;

    return (
        <>
            <h2 style={{ fontSize: '3rem', margin: 0, color: "white" }}>Green Apple</h2>
            <p style={{ opacity: 0.7, color: "white" }}>Frame: {frame}</p>
        </>
    );
};


```

---

## Documentation & Guides

Choose your path based on your role:

### 👤 For Humans
- [**Core Architecture**](https://docs.scroll.tube/architecture): Understand the state-snapshot engine.
- [**Asset Pipeline**](https://docs.scroll.tube/asset-pipeline): Learn how to use the CLI and AI tracking.
- [**React Hooks**](https://docs.scroll.tube/react-integration): Build custom interactive components.

### 🤖 For AI Agents
- [**AGENTS.md**](https://github.com/aleskozelsky/scrolltube/blob/main/AGENTS.md): Technical standard operating procedures for the repository.
- [**AI Integration Protocol**](https://docs.scroll.tube/ai-integration): How to prompt agents to build scenes for you.

---

## Performance & Tech
- **WebGL Accelerated**: High-FPS rendering even for 4K sequences.
- **AI Subject Tracking**: Automatic (x,y) pinning via SAM 3.
- **Mouse-Interactive Parallax**: Automatic 3D depth map generation and rendering.
- **Object-Fit Support**: Responsive "Cover" and "Contain" logic built into the shader.

---

