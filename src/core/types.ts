/**
 * SCROLLTUBE - DECLARATIVE SCHEMA
 * 
 * This file defines the core data structures that allow an AI Agent 
 * to describe a scroll experience in one step.
 */

export interface ProjectConfiguration {
    version: string;
    settings: ProjectSettings;
    assets: SequenceAsset[];
    timeline: TimelineDefinition;
    source?: string; // NEW: Path to the original source video (relative to project root)
}


export interface ProjectSettings {
    baseResolution: { width: number; height: number };
    scrollMode: 'vh' | 'px'; // Whether durations are measured in viewport height or pixels
    basePath?: string; // Optional base path for resolving relative asset URLs
}

/**
 * ASSET SYSTEM
 */
export interface SequenceAsset {
    id: string;
    strategy: 'adaptive' | 'fixed';
    variants: AssetVariant[];
}

export interface AssetVariant {
    id: string;
    media: string; // Keep for fallback/legacy or debugging
    path: string;  // Folder or URL to the optimized image folder
    aspectRatio: string; // e.g. "9:16" or "16:9"
    frameCount: number;
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
    hasDepthMap?: boolean;
    // Subject Tracking Data
    subjects?: string[]; // Array of tracked subject IDs that have corresponding 000_tracking-[id].json files
}

export interface SubjectFrameData {
    frame: number;
    x: number; // 0-1 coordinate relative to the image variant center
    y: number; // 0-1 coordinate relative to the image variant center
    scale?: number; // Relative size of the subject in this frame (0-1)
}

/**
 * TIMELINE SYSTEM
 */
export interface TimelineDefinition {
    totalDuration: string | number; // e.g. "500vh"
    scenes: SceneDefinition[];
}

export interface SceneDefinition {
    id: string;
    assetId: string; // Refers to a SequenceAsset id
    startProgress: number; // 0-1 progress of the global timeline
    duration: number; // 0-1 duration relative to global timeline
    assetRange: [number, number]; // [startFrame, endFrame] from the sequence
    layers: LayerDefinition[];
}

/**
 * LAYER SYSTEM
 */
export type LayerDefinition = HTMLLayer | CanvasLayer;

export interface BaseLayer {
    id: string;
    type: string;
    zIndex?: number;

    // Positioning
    anchor: 'viewport' | 'subject'; // Critical: allows pinning text to the product
    position: ResponsiveCoordinate;
    animations: LayerAnimation[];
}

export interface HTMLLayer extends BaseLayer {
    type: 'html';
    content: string; // HTML string or template
    style?: Record<string, string>;
}

export interface CanvasLayer extends BaseLayer {
    type: 'canvas';
    // Instructions for canvas drawing...
}

/**
 * UTILITY TYPES
 */
export interface ResponsiveCoordinate {
    default: Point;
    mobile?: Point;
    tablet?: Point;
    desktop?: Point;
}

export interface Point {
    x: string | number;
    y: string | number;
}

export interface LayerAnimation {
    property: string; // e.g. 'opacity', 'scale', 'translateY'
    from: number | string;
    to: number | string;
    start: number; // 0-1 within the scene duration
    end: number;   // 0-1 within the scene duration
    easing?: string;
}
