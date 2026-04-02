#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { AssetPipeline } from '../pipeline';
import * as readline from 'readline';
import 'dotenv/config';

const pkg = require('../../package.json');

/**
 *  MEDIA QUERY BUILDER
 */


function buildVariantsFromIds(input: (string | number | any)[]): any[] {
  const result: any[] = [];
  const orientations: ('portrait' | 'landscape')[] = ['portrait', 'landscape'];

  // 1. Process each "Target" resolution
  input.forEach(item => {
    let res = 0;
    if (typeof item === 'number') res = item;
    else if (typeof item === 'string') res = parseInt(item);
    else if (item.height) res = item.height; // Assume height is the defining metric

    if (!res || isNaN(res)) return;

    orientations.forEach(orient => {
      const isPortrait = orient === 'portrait';
      const width = isPortrait ? res : Math.round(res * (16 / 9));
      const height = isPortrait ? Math.round(res * (16 / 9)) : res;

      result.push({
        id: `${res}p_${orient.substring(0, 1)}`,
        width,
        height,
        orientation: orient,
        aspectRatio: isPortrait ? '9:16' : '16:9',
        media: `(orientation: ${orient})` // Minimal fallback
      });
    });
  });

  // 2. Sort by height (ascending) so the engine finds the first one that fits
  return result.sort((a, b) => a.height - b.height);
}

/**
 * CONFIG LOADER
 * Looks for scrolltube.config.js/ts in the current working directory.
 */
async function loadProjectConfig(): Promise<any> {
  const possiblePaths = [
    path.join(process.cwd(), 'scrolltube.cli.config.js'),
    path.join(process.cwd(), 'scrolltube.cli.config.cjs'),
    path.join(process.cwd(), 'scrolltube.cli.config.ts')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        // For simplicity in CLI we handle commonjs/esm basics
        // If it's TS, it might need jiti or ts-node, but let's assume JS for now
        // or use a simple dynamic import if supported.
        return require(p);
      } catch (e) {
        console.warn(chalk.yellow(`⚠️  Found config at ${p} but failed to load it. Skipping...`));
      }
    }
  }
  return null;
}

/**
 * Robust FFmpeg Detection
 * Prioritizes bundled static binary, then system PATH.
 */
function getFFmpegPath(): string | null {
  // 1. Try bundled ffmpeg-static
  if (ffmpegStatic) return ffmpegStatic;

  // 2. Try system PATH
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch (e) {
    return null;
  }
}

const program = new Command();

program
  .name('scrolltube')
  .description('ScrollTube CLI - Immersive Web SDK')
  .version(pkg.version);

/**
 * Interactive Helper
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${chalk.cyan('?')} ${question}${defaultValue ? ` (${defaultValue})` : ''}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

program
  .command('create')
  .description('ONE-STEP: Transform video/images into a responsive ScrollTube')
  .argument('[input]', 'Path to input video or directory of images')
  .option('-o, --output <dir>', 'Output directory (deprecated, use --name)')
  .option('-p, --track <text>', 'Text prompt for subject tracking')
  .option('-n, --name <string>', 'Name of the project')
  .option('-v, --variants <string>', 'Comma-separated target resolutions (e.g. 720,1080)')
  .option('-s, --step <number>', 'Process every Nth frame (default: 1)', '1')
  .option('--cloud', 'Use Fal.ai for tracking and refinement')
  .option('--depth', 'Generate a 3D depth map for the displacement effect (Requires --cloud)')

  .action(async (inputArg: string | undefined, opts: { output?: string, track: string, cloud: boolean, step: string, depth: boolean, name?: string, variants?: string }) => {
    console.log(chalk.bold.blue('\n🎞️  ScrollTube Asset Pipeline\n'));

    // 0. PRE-FLIGHT CHECK
    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      console.error(chalk.red('\n❌ FFmpeg not found!'));
      console.log(chalk.yellow('This CLI requires FFmpeg to process videos.'));
      console.log('Please install it manually or ensure regular npm install was successful.');
      process.exit(1);
    }

    const projectConfig = await loadProjectConfig();
    let input = inputArg;
    let track = opts.track;
    let projectName = opts.name;
    let useTracking = opts.cloud; // Default to cloud if flag set
    let useDepth = opts.depth;
    let customVariants = projectConfig?.variants || (opts.variants ? buildVariantsFromIds(opts.variants.split(',')) : null);

    // 1. INPUT VALIDATION (Immediate)
    while (!input || !fs.existsSync(input)) {
      if (input && !fs.existsSync(input)) {
        console.error(chalk.red(`\n❌ Error: Input path "${input}" does not exist.`));
      }
      input = await prompt('Path to input video or directory of images');
    }



    // 2. PROJECT NAME & SETTINGS
    if (!projectName) {
      projectName = await prompt('Project name', 'scrolltube-project');
    }

    let step = parseInt(opts.step) || 1;
    if (!inputArg) {
      const stepInput = await prompt('Process every Nth frame (Step size)', '1');
      step = parseInt(stepInput) || 1;

      // New Interactive Prompts
      const trackSubject = await prompt(`Track a specific subject? ${chalk.dim('(Optional, AI requires key - e.g. "red car")')}`, '');
      if (trackSubject) {
        track = trackSubject;
        useTracking = true;
      }

      const wantDepth = await prompt(`Generate 3D depth maps? ${chalk.dim('(Optional, AI requires key)')} [y/N]`, 'n');
      if (wantDepth.toLowerCase() === 'y') {
        useDepth = true;
      }
    }

    // 3. KEY & AI VALIDATION
    const stubeKey = process.env.SCROLLTUBE_KEY;
    const falKey = process.env.FAL_KEY;
    const hasKey = !!(stubeKey || falKey);

    if ((useTracking || useDepth) && !hasKey) {
      console.log(chalk.yellow(`\n⚠️  The AI features you selected (${[useTracking ? 'Tracking' : '', useDepth ? 'Depth' : ''].filter(Boolean).join('/')}) require a Cloud Key.`));
      console.log(chalk.white('To enable these features, please:'));
      console.log(chalk.white(`   1. Get a key at ${chalk.bold.cyan('https://scroll.tube/api-key')}`));
      console.log(chalk.white(`   2. Set it in your .env: ${chalk.bold('SCROLLTUBE_KEY')}='scrolltube_key_****************' ${chalk.dim('(or FAL_KEY)')}\n`));

      const choice = await prompt('Continue without AI features (local fallback)? [y/N]', 'n');

      if (choice.toLowerCase() !== 'y') {
        console.log(chalk.red('\nProcess aborted. Please set your API key and try again.\n'));
        process.exit(1);
      }

      console.log(chalk.dim('\nFalling back to local processing (center-pinned, no depth)...\n'));

      useTracking = false;
      useDepth = false;
    }


    const pipeline = new AssetPipeline({
      apiKey: hasKey ? (stubeKey || falKey) : undefined,
      onProgress: (p: any) => {
        // You could add a progress bar here
      }
    });

    try {
      await pipeline.create({
        input: input,
        name: projectName,
        track: useTracking ? track : undefined,
        depth: useDepth,
        variants: customVariants || [720, 1080],
        step: step
      });

      console.log(chalk.bold.green(`\n✅ Project Created Successfully!`));
      console.log(chalk.white(`📍 Output: ${projectName}`));
      console.log(chalk.white(`📜 Config: scrolltube.json`));
      console.log(chalk.cyan(`\nNext: Import the .json into your <ScrollTubeCanvas project={...} />\n`));

    } catch (err: any) {

      console.error(chalk.red(`\n❌ Error during pipeline: ${err.message}`));
      process.exit(1);
    }
  });

// NEW UPDATE COMMAND
program
  .command('update')
  .description('Rerun extraction and tracking on an existing project')
  .argument('<dir>', 'Project directory')
  .option('-p, --track <text>', 'Additional subject to track')
  .action(async (dir: string, opts: { track?: string }) => {
    console.log(chalk.bold.yellow('\n♻️  ScrollTube Update Pipeline\n'));
    const projectPath = path.resolve(dir);
    const configPath = path.join(projectPath, 'scrolltube.json');

    if (!fs.existsSync(configPath)) {
      console.error(chalk.red('❌ Not a valid ScrollTube project directory (missing scrolltube.json).'));
      process.exit(1);
    }

    const config = await fs.readJson(configPath);
    if (config.version !== pkg.version) {
      console.warn(chalk.yellow(`⚠️  Version Mismatch: Project is ${config.version}, CLI is ${pkg.version}`));
    }

    console.log(chalk.red('⚠️  UNDER CONSTRUCTION'));
    console.log(chalk.yellow('The "update" command is currently being refactored for the Universal Pipeline.'));
    console.log(chalk.dim('Please use "scrolltube create" to regenerate your project for now.\n'));

    process.exit(0);
  });

program.parse(process.argv);