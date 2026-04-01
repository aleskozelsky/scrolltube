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

  join(...parts: string[]): string {
    return path.join(...parts);
  }

  resolve(...parts: string[]): string {
    return path.resolve(...parts);
  }

  async extractFrames(videoSource: string, outputDir: string, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // For simplicity, we use execSync in a promise or spawn for progress
      try {
        // ffmpeg -i input output%04d.png
        // For now, let's keep it simple like existing CLI
        execSync(`"${this.ffmpegPath}" -i "${videoSource}" "${outputDir}/frame_%04d.png"`, { stdio: 'inherit' });
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
}
