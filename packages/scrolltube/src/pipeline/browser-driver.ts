import { IPipelineDriver, VariantConfig } from './types';

export class BrowserDriver implements IPipelineDriver {
  private files: Map<string, Uint8Array | string> = new Map();

  constructor() {
    console.log('🌐 BrowserDriver initialized');
  }

  async readFile(path: string): Promise<Uint8Array> {
    const data = this.files.get(path);
    if (!data) throw new Error(`File not found: ${path}`);
    if (typeof data === 'string') return new TextEncoder().encode(data);
    return data;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    this.files.set(path, data);
  }

  async mkdir(path: string): Promise<void> {
    // Virtual folders - no-op for simple Map implementation
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async readdir(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(dirPath)) {
        // Simple relative path extraction
        const relative = key.replace(dirPath, '').replace(/^[\\\/]/, '');
        if (relative && !relative.includes('/') && !relative.includes('\\')) {
          results.push(relative);
        }
      }
    }
    return results;
  }

  async remove(path: string): Promise<void> {
    // 1. Delete the exact file/folder key
    this.files.delete(path);
    
    // 2. Delete all children (recursive cleanup for virtual folders)
    const prefix = path.endsWith('/') ? path : `${path}/`;
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        this.files.delete(key);
      }
    }
  }

  join(...parts: string[]): string {
    return parts.join('/').replace(/\/+/g, '/');
  }

  resolve(...parts: string[]): string {
    return this.join(...parts);
  }

  /**
   * EXTRACT FRAMES (via ffmpeg.wasm)
   * Note: Requires SharedArrayBuffer & specific Headers if using multithreading.
   */
  async extractFrames(videoSource: string | File | Blob, outputDir: string, onProgress?: (percent: number) => void): Promise<void> {
    try {
      // Dynamic import to keep core bundle small
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('progress', ({ progress }: any) => {
        if (onProgress) onProgress(Math.round(progress * 100));
      });

      // Load FFmpeg WASM
      // You'll need to provide the correct URL for the core/worker files in your WP plugin
      await ffmpeg.load({
        coreURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm`, 'application/wasm'),
      });

      const inputName = 'input.mp4';
      await ffmpeg.writeFile(inputName, await fetchFile(videoSource));

      // Extract as PNGs/WebPs (WebP might be faster if supported in the WASM build)
      await ffmpeg.exec(['-i', inputName, `${outputDir}/frame_%04d.png`]);

      // Move files from FFmpeg VFS to our Map FS
      const files = await ffmpeg.listDir(outputDir);
      for (const file of files) {
        if (file.name.startsWith('frame_')) {
          const data = await ffmpeg.readFile(`${outputDir}/${file.name}`);
          await this.writeFile(this.join(outputDir, file.name), data as Uint8Array);
        }
      }

      await ffmpeg.terminate();
    } catch (err) {
      console.error('FFmpeg WASM Error:', err);
      throw new Error('Failed to extract frames in browser. Did you enable SharedArrayBuffer headers?');
    }
  }

  /**
   * PROCESS IMAGE (via Canvas API)
   * High-performance resizing and cropping using the browser's hardware-accelerated Canvas.
   */
  async processImage(input: Uint8Array | string, config: VariantConfig, options: { grayscale?: boolean, blur?: number } = {}): Promise<Uint8Array> {
    // 1. Load image into a bitmap
    let blob: Blob;
    if (typeof input === 'string') {
        const data = await this.readFile(input);
        blob = new Blob([data as any]);
    } else {
        blob = new Blob([input as any]);
    }

    const img = await createImageBitmap(blob);
    
    // 2. Setup Canvas
    const canvas = new OffscreenCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get Canvas context');

    // 3. Smart Crop Logic (simplified to cover/center)
    const scale = Math.max(config.width / img.width, config.height / img.height);
    const x = (config.width - img.width * scale) / 2;
    const y = (config.height - img.height * scale) / 2;

    // Apply filters
    let filters = '';
    if (options.grayscale) filters += 'grayscale(100%) ';
    if (options.blur) filters += `blur(${options.blur}px) `;
    if (filters) ctx.filter = filters.trim();

    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    // 4. Encode to WebP
    const outputBlob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.8
    });

    return new Uint8Array(await outputBlob.arrayBuffer());
  }

  /**
   * ZIP PROJECT (via JSZip)
   * Bundles all processed assets into a single file for upload or download.
   */
  async zipProject(outDir: string): Promise<Uint8Array> {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    for (const [path, data] of this.files.entries()) {
        if (path.startsWith(outDir)) {
            const relativePath = path.replace(outDir, '').replace(/^[\\\/]/, '');
            zip.file(relativePath, data);
        }
    }

    return await zip.generateAsync({ type: 'uint8array' });
  }
}
