import * as fs from 'fs-extra';
import * as path from 'path';
import sharp from 'sharp';
import { execSync, spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { IPipelineDriver, VariantConfig } from './types';

export class NodeDriver implements IPipelineDriver {
  private ffmpegPath: string;

  constructor() {
    this.ffmpegPath = ffmpegStatic || 'ffmpeg';
  }

  async readFile(filePath: string): Promise<Uint8Array> {
    return await fs.readFile(filePath);
  }

  async writeFile(filePath: string, data: Uint8Array | string): Promise<void> {
    if (typeof data === 'string') {
      await fs.writeFile(filePath, data);
    } else {
      await fs.writeFile(filePath, Buffer.from(data));
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  async exists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
  }

  async readdir(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }

  async remove(filePath: string): Promise<void> {
    await fs.remove(filePath);
  }
  
  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copy(src, dest);
  }


  join(...parts: string[]): string {
    return path.join(...parts);
  }

  resolve(...parts: string[]): string {
    return path.resolve(...parts);
  }

  async getVideoDimensions(input: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
      try {
        const result = execSync(`"${this.ffmpegPath}" -i "${input}"`, { stdio: 'pipe' }).toString();
        // ffmpeg outputs info to stderr, which execSync might throw on if -i is used without an output file
        this.parseDimensions(result, resolve, reject);
      } catch (err: any) {
        // execSync throws if exit code != 0, but ffmpeg -i returns 1 because no output file 
        const output = err.stderr ? err.stderr.toString() : (err.stdout ? err.stdout.toString() : '');
        this.parseDimensions(output, resolve, reject);
      }
    });
  }

  private parseDimensions(output: string, resolve: any, reject: any) {
    const match = output.match(/, (\d{2,5})x(\d{2,5})/);
    if (match) {
      resolve({ width: parseInt(match[1]), height: parseInt(match[2]) });
    } else {
      reject(new Error('Could not parse video dimensions.'));
    }
  }

  async extractFrames(videoSource: string, outputDir: string, onProgress?: (percent: number) => void): Promise<void> {

    return new Promise((resolve, reject) => {
      // For simplicity, we use execSync in a promise or spawn for progress
      try {
        // ffmpeg -i input output%04d.png
        // For now, let's keep it simple like existing CLI
        execSync(`"${this.ffmpegPath}" -hide_banner -loglevel error -i "${videoSource}" "${outputDir}/frame_%04d.png"`, { stdio: 'inherit' });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async processImage(input: Uint8Array | string, config: VariantConfig, options: { grayscale?: boolean, blur?: number } = {}): Promise<Uint8Array> {
    let pipeline = sharp(input)
      .resize(config.width, config.height, {
        fit: 'cover',
        position: 'center' // Placeholder for smart-crop logic if we move it here
      });

    if (options.grayscale) {
      pipeline = pipeline.grayscale();
    }

    if (options.blur) {
      pipeline = pipeline.blur(options.blur);
    }

    return await pipeline.webp({ quality: 80 }).toBuffer();
  }

  async zipProject(outDir: string): Promise<Uint8Array> {
    const JSZip = require('jszip');
    const zip = new JSZip();

    const addFilesRecursively = async (currentDir: string, zipFolder: any) => {
      const files = await fs.readdir(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          const folder = zipFolder.folder(file);
          await addFilesRecursively(fullPath, folder);
        } else {
          const content = await fs.readFile(fullPath);
          zipFolder.file(file, content);
        }
      }
    };

    await addFilesRecursively(outDir, zip);
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Also save it locally for Node (optional but helpful?)
    // No, IPipelineDriver contract says return Uint8Array.
    // The caller (AssetPipeline) handles what to do with it.
    return new Uint8Array(content);
  }
}
