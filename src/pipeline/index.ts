import { IPipelineDriver, PipelineOptions, PipelineProgress, CreateCommandOptions, VariantConfig } from './types';
import { CloudService } from './cloud-service';
import { ProjectConfiguration, AssetVariant, SubjectFrameData } from '../core/types';

export class AssetPipeline {
  private driver!: IPipelineDriver;
  private options: PipelineOptions;
  private cloud: CloudService;

  constructor(options: PipelineOptions = {}) {
    this.options = options;
    this.cloud = new CloudService({ apiKey: options.apiKey, proxyUrl: options.proxyUrl });
  }

  /**
   * INITIALIZE DRIVER
   * Detects environment and loads the appropriate driver dynamically.
   */
  async init() {
    if (this.driver) return;

    if (typeof window !== 'undefined') {
      // Browser Environment
      try {
        // @ts-ignore - Assuming BrowserDriver will exist in same folder
        const { BrowserDriver } = await import('./browser-driver');
        this.driver = new BrowserDriver();
      } catch (e) {
        throw new Error('Could not load BrowserDriver. Ensure @scrolltube/pipeline/browser is available.');
      }
    } else {
      // Node Environment
      try {
        const { NodeDriver } = await import('./node-driver');
        this.driver = new NodeDriver();
      } catch (e) {
        throw new Error('Could not load NodeDriver. Ensure @scrolltube/pipeline/node (sharp, ffmpeg) is installed.');
      }
    }
  }

  private report(step: PipelineProgress['step'], percent: number, message: string) {
    if (this.options.onProgress) {
      this.options.onProgress({ step, percent, message });
    }
    console.log(`[${step}] ${percent}% - ${message}`);
  }

  /**
   * THE MAIN ORCHESTRATOR
   */
  async create(opts: CreateCommandOptions) {
    await this.init();
    const { input, name, track, depth, step = 1 } = opts;
    const outDir = this.driver.resolve(name);
    const tempDir = this.driver.join(outDir, '.temp-frames');
    const framesDir = this.driver.join(tempDir, 'frames');
    const depthsDir = this.driver.join(tempDir, 'depths');

    this.report('initializing', 0, `Creating project: ${name}`);
    await this.driver.mkdir(outDir);
    await this.driver.mkdir(tempDir);
    await this.driver.mkdir(framesDir);
    await this.driver.mkdir(depthsDir);

    // 1. FRAME EXTRACTION
    this.report('extracting', 10, 'Extracting frames from source...');
    await this.driver.extractFrames(input, framesDir);

    // 2. AI TRACKING & DEPTH
    let trackingData: SubjectFrameData[] = [];
    let isDepthActive = false;

    if (track || depth) {
      this.report('tracking', 30, 'Performing AI analysis...');
      if (track) {
        trackingData = await this.cloud.trackSubject(input, this.driver, track);
      }
      if (depth) {
        this.report('depth', 40, 'Generating depth maps...');
        const depthVideoUrl = await this.cloud.generateDepthMap(input, this.driver);
        // Download and extract depth frames
        const response = await fetch(depthVideoUrl);
        const buffer = await response.arrayBuffer();
        const depthVideoPath = this.driver.join(tempDir, 'depth_video.mp4');
        await this.driver.writeFile(depthVideoPath, new Uint8Array(buffer));
        await this.driver.extractFrames(depthVideoPath, depthsDir);
        isDepthActive = true;
      }
    }

    // Default tracking if none
    if (trackingData.length === 0) {
      const files = await this.driver.readdir(framesDir);
      const frameFiles = files.filter(f => f.startsWith('frame_'));
      trackingData = frameFiles.map((_, i) => ({ frame: i, x: 0.5, y: 0.5, scale: 0 }));
    }

    // 3. VARIANT GENERATION
    this.report('processing', 60, 'Generating optimized variants...');
    const variants = await this.processVariants(tempDir, trackingData, {
      step,
      depth: isDepthActive,
      variants: this.normalizeVariants(opts.variants),
      outDir
    });

    // 4. SAVE CONFIG
    this.report('saving', 90, 'Finalizing project configuration...');
    const config = await this.saveConfig(variants, outDir);

    // Cleanup
    await this.driver.remove(tempDir);

    this.report('saving', 100, 'Project ready!');

    if (opts.outputZip && this.driver.zipProject) {
      return await this.driver.zipProject(outDir);
    }

    return config;
  }

  private normalizeVariants(v: number[] | VariantConfig[]): VariantConfig[] {
    if (v.length === 0) return [];
    if (typeof v[0] === 'object') return v as VariantConfig[];

    // Convert numbers to baseline portrait/landscape pairs
    const res = v as number[];
    const normalized: VariantConfig[] = [];
    res.forEach(r => {
      normalized.push({
        id: `${r}p_p`, width: r, height: Math.round(r * (16 / 9)),
        orientation: 'portrait', aspectRatio: '9:16', media: '(orientation: portrait)'
      });
      normalized.push({
        id: `${r}p_l`, width: Math.round(r * (16 / 9)), height: r,
        orientation: 'landscape', aspectRatio: '16:9', media: '(orientation: landscape)'
      });
    });
    return normalized;
  }

  private async processVariants(tempDir: string, trackingData: SubjectFrameData[], options: { step: number, depth: boolean, variants: VariantConfig[], outDir: string }) {
    const { step, outDir } = options;
    const framesDir = this.driver.join(tempDir, 'frames');
    const depthsDir = this.driver.join(tempDir, 'depths');

    const allFiles = await this.driver.readdir(framesDir);
    const allFrames = allFiles.filter(f => f.startsWith('frame_')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const framesToProcess = allFrames.filter((_, i) => i % step === 0);

    const assetVariants: AssetVariant[] = [];

    for (const config of options.variants) {
      const variantDir = this.driver.join(outDir, config.id);
      await this.driver.mkdir(variantDir);

      const variantTracking: SubjectFrameData[] = [];

      for (let i = 0; i < framesToProcess.length; i++) {
        const originalIndex = i * step;
        const frameName = framesToProcess[i];
        const framePath = this.driver.join(framesDir, frameName);
        const targetPath = this.driver.join(variantDir, `index_${i}.webp`);

        const subject = trackingData.find(f => f.frame === originalIndex) || { frame: originalIndex, x: 0.5, y: 0.5, scale: 0 };

        const imageBuffer = await this.driver.processImage(framePath, config, {});
        await this.driver.writeFile(targetPath, imageBuffer);

        if (options.depth) {
          const depthPath = this.driver.join(depthsDir, frameName);
          if (await this.driver.exists(depthPath)) {
            const depthBuffer = await this.driver.processImage(depthPath, config, { grayscale: true, blur: 2 });
            await this.driver.writeFile(this.driver.join(variantDir, `index_${i}_depth.webp`), depthBuffer);
          }
        }

        variantTracking.push({ ...subject, frame: i });
      }

      await this.driver.writeFile(this.driver.join(variantDir, '000_tracking-main.json'), JSON.stringify(variantTracking, null, 2));

      assetVariants.push({
        id: config.id,
        media: config.media,
        width: config.width,
        height: config.height,
        orientation: config.orientation,
        aspectRatio: config.aspectRatio,
        path: `./${config.id}`,
        frameCount: framesToProcess.length,
        hasDepthMap: options.depth,
        subjects: ['main']
      });
    }

    return assetVariants;
  }

  async saveConfig(variants: AssetVariant[], outDir: string): Promise<ProjectConfiguration> {
    const pkg = require('../../package.json');
    const config: ProjectConfiguration = {
      version: pkg.version,
      settings: { baseResolution: { width: 1920, height: 1080 }, scrollMode: 'vh' },
      assets: [{ id: "main-sequence", strategy: "adaptive", variants: variants }],
      timeline: {
        totalDuration: "300vh",
        scenes: [{
          id: "scene-1", assetId: "main-sequence", startProgress: 0, duration: 1,
          assetRange: [0, variants[0].frameCount - 1], layers: []
        }]
      }
    };

    await this.driver.writeFile(this.driver.join(outDir, 'scrolltube.json'), JSON.stringify(config, null, 2));
    return config;
  }
}
