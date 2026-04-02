import { ProjectConfiguration, SubjectFrameData } from '../core/types';

export interface PipelineProgress {
  percent: number;
  message: string;
  step: 'initializing' | 'extracting' | 'tracking' | 'depth' | 'processing' | 'saving';
}

export interface VariantConfig {
  id: string;
  width: number;
  height: number;
  media: string;
  orientation: 'portrait' | 'landscape';
  aspectRatio: string;
}

export interface IPipelineDriver {
  // File System Abstraction
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readdir(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;

  
  // Path helpers
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;

  // Media Processing
  getVideoDimensions(input: string | File | Blob): Promise<{ width: number, height: number }>;
  extractFrames(videoSource: string | File | Blob, outputDir: string, onProgress?: (percent: number) => void): Promise<void>;

  processImage(input: Uint8Array | string, config: VariantConfig, options: { grayscale?: boolean, blur?: number }): Promise<Uint8Array>;
  
  // Optional for ZIP support
  zipProject?(outDir: string): Promise<Uint8Array>;
}

export interface PipelineOptions {
  apiKey?: string;
  proxyUrl?: string;
  onProgress?: (progress: PipelineProgress) => void;
}

export interface CreateCommandOptions {
  input: string | File | Blob;
  name: string;
  track?: string;
  depth?: boolean;
  variants: number[] | VariantConfig[];
  step?: number;
  outputZip?: boolean;
}
