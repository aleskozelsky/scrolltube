# Asset Pipeline: The Universal Engine
 

The ScrollTube Asset Pipeline is a platform-agnostic engine designed to do the "hard work" of segmentation, tracking, and optimization. It runs exactly the same logic whether you are in your terminal or a WordPress dashboard.

## 1. Universal Architecture

The pipeline uses a **Strategy Pattern** with two primary drivers:

| Driver | Environment | Technology |
| :--- | :--- | :--- |
| **NodeDriver** | CLI / Backend | `sharp`, `ffmpeg-static` |
| **BrowserDriver** | CMS / Frontend | `ffmpeg.wasm`, `OffscreenCanvas` |

This means you have a single source of truth for your processing logic, while benefiting from the best native tools available to each platform.

---

## 2. CLI Usage

The `npx stube create` command is the primary wrapper for the pipeline on your local machine.
 
 ```bash
 npx stube create <input> [options]
 ```
 
 ### Options:
 - `-n, --name <string>`: Project folder name.
 - `-p, --track <text>`: Target object to track (e.g. "red car").
 - `-v, --variants <string>`: Comma-separated target resolutions (e.g. `720,1080`).
 - `-s, --step <number>`: Process every Nth frame. **VITAL for performance**.
 - `--cloud`: Use Fal.ai for tracking (requires `FAL_KEY`).
 - `--depth`: Generate a corresponding image sequence of depth maps for the 3D parallax effect.
 

---

## 3. Programmatic Usage (SDK)

For building your own CMS plugins or web-based authoring tools, you can import the pipeline directly:

```typescript
import { AssetPipeline } from 'scrolltube/pipeline';

const pipeline = new AssetPipeline({ 
  apiKey: '...', 
  onProgress: (p) => updateUI(p.percent) 
});

// Returns a ZIP blob containing the entire project
const zip = await pipeline.create({
  input: myFileObject,
  name: 'project-name',
  outputZip: true
});
```

### Core Pipeline Steps:
 1.  **Auto-Upload**: If you provide a local `.mp4`, it's automatically uploaded to the cloud for processing.
 2.  **Extraction**: Converts video files into high-quality image sequences.
 3.  **AI Tracking**: Identifies the main subject (using **SAM 3**). Our engine now features **Sticky Tracking**—if the subject is obscured for a few frames, the coordinates hold their last known position.
 4.  **Variant Generation**: 
     - **Smart Crop**: Centers the images based on the tracked subject.
     - **Resolution Factory**: Creates Portrait (9:16) and Landscape (16:9) pairs for each target resolution (e.g. 720p, 1080p).
    - **Compression**: Optimized `.webp` generation via Sharp (Node) or Canvas (Browser).
 5.  **Metadata Export**: Generates the final `scrolltube.json` with **root-relative paths** for easier deployment.
 
 ---
 
## 2. Cloud vs Local Processing

The pipeline is split into a **Local Implementation** path and a **Cloud-Accelerated** path.

### 🏠 Local Implementation (Free)
- Uses **FFmpeg** on your machine for extraction.
- Uses **Sharp** for resizing and cropping.
- Does **not** include automatic AI point-tracking (uses center-pinned defaults).

### ☁️ Cloud-Accelerated Implementation (Paid)
- **Fal.ai Integration**: Triggers high-end GPUs to run SAM 3 tracking.
- **Refinement**: Can be configured to auto-remove backgrounds or upscale low-res sequences using ESRGAN.
- **CDN Ready**: Prepares assets for cloud hosting.

## 4. Environment Drivers

### 🏠 NodeDriver
- **Extraction**: Native FFmpeg binary.
- **Image Engine**: **Sharp** (C++).

### 🌐 BrowserDriver
- **Extraction**: **ffmpeg.wasm**.
- **Image Engine**: **OffscreenCanvas** (Hardware-accelerated).
- **Output**: Persistent IndexedDB or a downloadable **ZIP**.

---

## 3. Configuration (.env.local)

To use the cloud features, you must provide your own API keys in your `.env.local`:

```bash
FAL_KEY="your-fal-api-key"
```

*Note: This mimics the Remotion "Bring Your Own Key" model for indie developers.*
