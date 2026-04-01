import { ProjectConfiguration, SequenceAsset, AssetVariant, SubjectFrameData } from './types';
import { WebGLRenderer } from './WebGLRenderer';

/**
 * SCROLLTUBE CORE ENGINE
 * 
 * A declarative, performant engine that maps scroll progress 
 * to high-performance image sequence rendering.
 */
export class CoreEngine {
    private config: ProjectConfiguration;
    private currentFrame: number = -1;
    private activeVariant: AssetVariant | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private renderer: WebGLRenderer | null = null;

    public basePath: string = '';
    public scrub: number = 0;
    public depthTilt: number = 4;

    // Playback State
    private targetProgress: number = 0;
    private currentProgress: number = 0;
    private rafId: number = 0;
    private destroyed: boolean = false;

    // Internal Cache
    private imageCache: Map<string, HTMLImageElement> = new Map();
    private depthCache: Map<string, HTMLImageElement> = new Map();
    private scrollTimeout: any = null;
    private trackingDataCache: Map<string, SubjectFrameData[]> = new Map();

    // Event hooks
    public onFrameChange?: (frame: number, progress: number) => void;
    public onProgressUpdate?: (progress: number) => void;

    private boundResize: () => void;

    constructor(config: ProjectConfiguration, options: { scrub?: number; depthTilt?: number } = {}) {
        this.config = config;
        this.basePath = config.settings.basePath || '';
        this.scrub = options.scrub !== undefined ? options.scrub : 0;
        this.depthTilt = options.depthTilt !== undefined ? options.depthTilt : 4;
        this.detectBestVariant();

        this.boundResize = () => {
            this.detectBestVariant();
            this.resizeCanvas();
            this.render(); // Re-render current frame on resize
        };

        // Listen for window resize to swap variants (Adaptive Rendering)
        window.addEventListener('resize', this.boundResize);

        // Start render loop
        this.updateLoop = this.updateLoop.bind(this);
        this.rafId = requestAnimationFrame(this.updateLoop);
    }

    public destroy() {
        this.destroyed = true;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        window.removeEventListener('resize', this.boundResize);
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        this.clearCache();
        this.trackingDataCache.clear();
        this.canvas = null;
        this.ctx = null;
        this.renderer = null;
        this.onFrameChange = undefined;
    }

    public static async init(container: HTMLElement, configUrl: string): Promise<CoreEngine> {
        const res = await fetch(configUrl);
        if (!res.ok) throw new Error(`Failed to load config: ${res.statusText}`);
        const config: ProjectConfiguration = await res.json();

        // Auto-detect base path from URL
        const basePath = configUrl.substring(0, configUrl.lastIndexOf('/'));
        if (!config.settings) {
            config.settings = { baseResolution: { width: 1920, height: 1080 }, scrollMode: 'vh' };
        }
        config.settings.basePath = config.settings.basePath || basePath;

        const engine = new CoreEngine(config, { scrub: typeof config.settings === 'object' ? (config.settings as any).scrub : 0 });

        let canvas = container.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';
            canvas.style.objectFit = 'cover';
            container.appendChild(canvas);
        }

        engine.attachCanvas(canvas);
        return engine;
    }

    /**
     * ATTACH CANVAS
     * Connects the engine to a DOM element for rendering.
     */
    public attachCanvas(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        try {
            this.renderer = new WebGLRenderer(canvas, { depthTilt: this.depthTilt });
        } catch (e) {
            console.warn("WebGL failed, falling back to 2D", e);
            this.ctx = canvas.getContext('2d', { alpha: false });
        }
        this.resizeCanvas();
        this.render();
    }

    private resizeCanvas() {
        if (!this.canvas) return;

        // Use actual layout dimensions of the canvas
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Set actual size (retina support)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        if (this.ctx) {
            this.ctx.scale(dpr, dpr);
        }
    }

    /**
     * SMART VARIANT SELECTION
     * Selects the best image variant based on physical pixel requirements 
     * and the dimensions of the parent container.
     */
    private detectBestVariant() {
        const firstSequence = this.config.assets[0];
        if (!firstSequence) return;

        // Use the canvas's own layout size, or fallback to window if not attached
        const rect = this.canvas
            ? this.canvas.getBoundingClientRect()
            : { width: window.innerWidth, height: window.innerHeight };

        const isPortrait = rect.height > rect.width;
        const targetWidth = rect.width * (window.devicePixelRatio || 1);

        // 1. Filter variants by current orientation
        const candidates = firstSequence.variants.filter(v => {
            const variantIsPortrait = (v as any).orientation === 'portrait' || (parseInt(v.aspectRatio.split(':')[1]) > parseInt(v.aspectRatio.split(':')[0]));
            return isPortrait === variantIsPortrait;
        });

        // 2. Find the best resolution match (smallest variant that is >= targetWidth)
        candidates.sort((a, b) => a.frameCount - b.frameCount); // Temporary sort placeholder if width is missing, but let's assume we have it in types

        // Let's use width from the variant if available (we'll add it to types)
        const bestMatch = candidates.find(v => (v as any).width >= targetWidth) || candidates[candidates.length - 1];

        if (!bestMatch) {
            console.warn('[CoreEngine] No suitable variant found');
            return;
        }

        if (this.activeVariant?.id !== bestMatch.id) {
            console.log(`🎯 Variant Switched: ${bestMatch.id} (${isPortrait ? 'Portrait' : 'Landscape'})`);
            this.activeVariant = bestMatch;
            this.clearCache();
            this.preloadInitial();
        }
    }

    private clearCache() {
        this.imageCache.clear();
        this.depthCache.clear();
    }

    private preloadInitial() {
        for (let i = 0; i < 15; i++) {
            this.getImage(i);
        }
    }

    /**
     * THE PLAYER ENGINE
     * Sets the target scroll progress. Actual rendering interpolates to this value.
     */
    public update(progress: number) {
        this.targetProgress = Math.max(0, Math.min(1, progress));
    }

    public setDepthTilt(tilt: number) {
        this.depthTilt = tilt;
        if (this.renderer) {
            this.renderer.setDepthTilt(tilt);
        }
    }

    private updateLoop() {
        if (this.destroyed) return;
        this.rafId = requestAnimationFrame(this.updateLoop);

        const scrub = this.scrub;

        if (scrub > 0) {
            // Smooth delay (lower factor = more delay)
            const factor = Math.max(0.01, 1 - scrub);
            this.currentProgress += (this.targetProgress - this.currentProgress) * factor;
        } else {
            this.currentProgress = this.targetProgress;
        }

        if (Math.abs(this.targetProgress - this.currentProgress) < 0.0001) {
            this.currentProgress = this.targetProgress;
        }

        if (this.onProgressUpdate) {
            this.onProgressUpdate(this.currentProgress);
        }

        this.calculateFrame(this.currentProgress);
    }

    private calculateFrame(progress: number) {
        const scene = this.config.timeline.scenes[0];
        if (!scene) return;

        const totalFrames = scene.assetRange[1] - scene.assetRange[0];
        const localFrame = Math.floor(scene.assetRange[0] + (progress * totalFrames));
        // clamp frame to valid range
        const finalFrame = Math.max(0, Math.min(localFrame, scene.assetRange[1]));

        if (finalFrame !== this.currentFrame) {
            this.currentFrame = finalFrame;
            this.render();
            // Predictive preloading
            this.getImage(this.currentFrame + 5);
            this.getImage(this.currentFrame + 10);

            // Lazy load depth map when scroll stops
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.loadDepthMap(this.currentFrame);
            }, 100);

            if (this.onFrameChange) {
                this.onFrameChange(this.currentFrame, progress);
            }
        }
    }

    /**
     * LOAD SUBJECT TRACKING (On-Demand)
     */
    public async loadTrackingData(subjectId: string): Promise<void> {
        if (!this.activeVariant) return;
        if (!this.activeVariant.subjects?.includes(subjectId)) {
            console.warn(`[CoreEngine] Subject ${subjectId} not found in active variant ${this.activeVariant.id}`);
            return;
        }

        const cacheKey = `${this.activeVariant.id}_${subjectId}`;
        if (this.trackingDataCache.has(cacheKey)) return;

        try {
            const prefix = this.basePath ? `${this.basePath}/` : '';
            const url = `${prefix}${this.activeVariant.path}/000_tracking-${subjectId}.json`;
            console.log(`[CoreEngine] Fetching tracking data: ${url}`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(res.statusText);
            const data: SubjectFrameData[] = await res.json();
            this.trackingDataCache.set(cacheKey, data);
        } catch (e) {
            console.error(`[CoreEngine] Failed to load tracking data for ${subjectId}`, e);
        }
    }

    public getTrackedCoords(subjectId: string, frame: number): { x: number, y: number, scale?: number } {
        if (!this.activeVariant || !this.canvas) return { x: 0.5, y: 0.5 };
        const cacheKey = `${this.activeVariant.id}_${subjectId}`;
        const data = this.trackingDataCache.get(cacheKey);
        if (!data) return { x: 0.5, y: 0.5 };

        const trackData = data.find(f => f.frame === frame);
        if (!trackData) return { x: 0.5, y: 0.5 };

        // --- OBJECT-FIT: COVER PROJECTION ---
        // Replicate the math used in WebGLRenderer.ts and render() fallback
        // to map image-relative coordinates to canvas-relative coordinates.
        const canvasWidth = this.canvas.clientWidth;
        const canvasHeight = this.canvas.clientHeight;
        const imgWidth = this.activeVariant.width;
        const imgHeight = this.activeVariant.height;

        const canvasRatio = canvasWidth / canvasHeight;
        const imgRatio = imgWidth / imgHeight;

        const ratioX = Math.min(canvasRatio / imgRatio, 1.0);
        const ratioY = Math.min((1.0 / canvasRatio) / (1.0 / imgRatio), 1.0);

        // Inverse projection from image space back to screen space
        // imgX = screenX * ratioX + (1.0 - ratioX) * 0.5
        // screenX = (imgX - 0.5) / ratioX + 0.5
        const screenX = (trackData.x - 0.5) / ratioX + 0.5;
        const screenY = (trackData.y - 0.5) / ratioY + 0.5;

        return { x: screenX, y: screenY, scale: trackData.scale };
    }

    /**
     * RENDER LOOP
     * Draws the image to the canvas with object-fit: cover logic.
     */
    private render() {
        if (!this.canvas || this.currentFrame === -1) return;

        const img = this.getImage(this.currentFrame);
        if (!img || !img.complete) return;

        const canvasWidth = this.canvas.clientWidth;
        const canvasHeight = this.canvas.clientHeight;

        let depthImg = null;
        if (this.activeVariant?.hasDepthMap) {
            depthImg = this.getDepthImage(this.currentFrame);
            if (depthImg && !depthImg.complete) depthImg = null;
        }

        if (this.renderer) {
            this.renderer.render(img, depthImg, canvasWidth * (window.devicePixelRatio || 1), canvasHeight * (window.devicePixelRatio || 1));
        } else if (this.ctx) {
            // ... fallback 2d ...
            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;
            const imgRatio = imgWidth / imgHeight;
            const canvasRatio = canvasWidth / canvasHeight;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgRatio > canvasRatio) {
                drawHeight = canvasHeight;
                drawWidth = canvasHeight * imgRatio;
                offsetX = (canvasWidth - drawWidth) / 2;
                offsetY = 0;
            } else {
                drawWidth = canvasWidth;
                drawHeight = canvasWidth / imgRatio;
                offsetX = 0;
                offsetY = (canvasHeight - drawHeight) / 2;
            }

            this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        }
    }

    private getImage(frame: number): HTMLImageElement | null {
        if (!this.activeVariant) return null;
        if (frame < 0 || frame >= this.activeVariant.frameCount) return null;

        const key = `${this.activeVariant.id}_${frame}`;
        if (this.imageCache.has(key)) return this.imageCache.get(key)!;

        const prefix = this.basePath ? `${this.basePath}/` : '';
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `${prefix}${this.activeVariant.path}/index_${frame}.webp`;
        img.onload = () => {
            if (this.currentFrame === frame) this.render();
        };
        this.imageCache.set(key, img);
        return img;
    }

    private loadDepthMap(frame: number) {
        if (!this.activeVariant?.hasDepthMap) {
            console.log("[CoreEngine] activeVariant does not define hasDepthMap=true");
            return;
        }
        console.log(`[CoreEngine] Lazy requesting depth map for frame: ${frame}`);
        const img = this.getDepthImage(frame);
        // getDepthImage triggers the download map
    }

    private getDepthImage(frame: number): HTMLImageElement | null {
        if (!this.activeVariant?.hasDepthMap) return null;
        if (frame < 0 || frame >= this.activeVariant.frameCount) return null;

        const key = `${this.activeVariant.id}_depth_${frame}`;
        if (this.depthCache.has(key)) return this.depthCache.get(key)!;

        const prefix = this.basePath ? `${this.basePath}/` : '';
        console.log(`[CoreEngine] Downloading: ${prefix}${this.activeVariant.path}/index_${frame}_depth.webp`);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `${prefix}${this.activeVariant.path}/index_${frame}_depth.webp`; // Matching user's request: frame_0_depth
        img.onload = () => {
            console.log(`[CoreEngine] Depth map loaded for frame: ${frame}`);
            if (this.currentFrame === frame) this.render();
        };
        img.onerror = (e) => {
            console.error(`[CoreEngine] Depth map failed to load for frame: ${frame}`, e);
        };
        this.depthCache.set(key, img);
        return img;
    }
}
