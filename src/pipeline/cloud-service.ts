import { fal } from "@fal-ai/client";
import { IPipelineDriver } from './types';
import { SubjectFrameData } from '../core/types';

export interface CloudOptions {
  apiKey?: string;
  baseUrl?: string;
  proxyUrl?: string; // Legacy: handle custom proxy endpoint
}

export class CloudService {
  private options: CloudOptions;
  private isScrollTube = false;

  constructor(options: CloudOptions = {}) {
    this.options = options;

    // Prioritize SCROLLTUBE_KEY from environment or options
    const envStube = typeof process !== 'undefined' ? process.env?.SCROLLTUBE_KEY : '';
    const envFal = typeof process !== 'undefined' ? process.env?.FAL_KEY : '';

    const key = options.apiKey || envStube || envFal;

    if (envStube || (options.apiKey && options.apiKey.startsWith('stube_'))) {
      this.isScrollTube = true;
    }

    if (!key && !options.proxyUrl) {
      // Don't throw yet, only when a cloud method is called
    }
  }

  private getAuthHeaders() {
    // For now, fal-ai/client uses the env variable FE_FAL_KEY or the key provided to it.
    // In the future, once we use a proxy, we'll manually set headers here.
    return {};
  }

  async trackSubject(input: string | File | Blob, driver: IPipelineDriver, prompt: string = "main subject"): Promise<SubjectFrameData[]> {
    let videoUrl: string;

    if (typeof input === 'string') {
      // Local path or URL
      if (await driver.exists(input)) {
        videoUrl = await this.uploadFile(input, driver);
      } else {
        videoUrl = input;
      }
    } else {
      // File or Blob
      videoUrl = await fal.storage.upload(input);
    }

    console.log(`🤖 AI is tracking "${prompt}" via SAM 3...`);

    const result: any = await fal.subscribe("fal-ai/sam-3/video-rle", {
      input: {
        video_url: videoUrl,
        prompt: prompt,
      },
      logs: true,
    });

    const payload = result.data || result;
    const boxes = payload.boxes;

    if (!boxes || !Array.isArray(boxes) || boxes.length === 0) {
      throw new Error(`AI tracking returned no data.`);
    }

    return this.mapBoxesToTrackingData(boxes);
  }

  async generateDepthMap(input: string | File | Blob, driver: IPipelineDriver): Promise<string> {
    let videoUrl: string;

    if (typeof input === 'string') {
      if (await driver.exists(input)) {
        videoUrl = await this.uploadFile(input, driver);
      } else {
        videoUrl = input;
      }
    } else {
      videoUrl = await fal.storage.upload(input);
    }

    console.log(`🤖 AI is generating Depth Map...`);

    const result: any = await fal.subscribe("fal-ai/video-depth-anything", {
      input: {
        video_url: videoUrl,
        model_size: "VDA-Base",
      },
      logs: true
    });

    const payload = result.data || result;
    if (!payload.video || !payload.video.url) {
      throw new Error(`AI Depth Map generation failed.`);
    }

    return payload.video.url;
  }

  private async uploadFile(filePath: string, driver: IPipelineDriver): Promise<string> {
    const data = await driver.readFile(filePath);
    return await fal.storage.upload(new Blob([data as any]));
  }

  private mapBoxesToTrackingData(boxes: any[]): SubjectFrameData[] {
    let lastKnown = { x: 0.5, y: 0.5, scale: 0 };
    return boxes.map((frameBoxes, i) => {
      if (frameBoxes && Array.isArray(frameBoxes)) {
        let box: number[] | null = null;
        if (typeof frameBoxes[0] === 'number' && frameBoxes.length >= 4) {
          box = frameBoxes;
        } else if (Array.isArray(frameBoxes[0]) && frameBoxes[0].length >= 4) {
          box = frameBoxes[0];
        } else if (typeof frameBoxes[0] === 'object' && frameBoxes[0].box_2d) {
          box = frameBoxes[0].box_2d;
        }

        if (box) {
          lastKnown = { x: box[0], y: box[1], scale: box[2] * box[3] };
        }
      }
      return { frame: i, ...lastKnown };
    });
  }
}
