import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { CoreEngine, CoreOrchestrator } from '../core';

interface STUBEContext {
    progress: number;
    frame: number;
    engine: CoreEngine | null;
}

const ScrollTubeContext = createContext<STUBEContext | null>(null);

export interface ScrollTubeProviderProps {
    type?: string;
    containerHeight?: string;
    sceneHeight?: string; // instead of canvasHeight
    sceneTop?: string | 0;
    offset?: any;
    scrub?: number;
    children: React.ReactNode;
}

export const ScrollTubeProvider: React.FC<ScrollTubeProviderProps> = ({
    type = 'sticky',
    containerHeight = '400vh',
    sceneHeight = '100vh',
    sceneTop = 0,
    offset = ['start end', 'end start'],
    scrub = 0,
    children
}) => {
    const [state, setState] = useState<Omit<STUBEContext, 'engine'>>({ progress: 0, frame: -1 });
    const [engineReady, setEngineReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const orchestratorRef = useRef<CoreOrchestrator | null>(null);
    const offsetStr = JSON.stringify(offset);

    useEffect(() => {
        let isMounted = true;

        if (!containerRef.current) return;

        const init = async () => {
            const orchestrator = new CoreOrchestrator(containerRef.current!, { scrub });
            orchestratorRef.current = orchestrator;

            // Hook React State to the Orchestrator's unified callback
            orchestrator.onFrameChange = (frame, progress) => {
                if (isMounted) setState({ frame, progress });
            };

            await orchestrator.init();

            if (isMounted) setEngineReady(true);
        };

        const timeoutId = setTimeout(() => {
            // Slight delay ensures children nodes & DOM are fully mounted before Orchestrator queries them
            init();
        }, 0);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (orchestratorRef.current) {
                orchestratorRef.current.destroy();
                orchestratorRef.current = null;
            }
        };
    }, [scrub, offsetStr]);

    // Sync state for engine access
    const engine = orchestratorRef.current?.getEngine() || null;

    return (
        <ScrollTubeContext.Provider value={{ ...state, engine }}>
            <div
                ref={containerRef}
                className="stube-container"
                style={{ position: 'relative', height: containerHeight }}
                data-stube-offset={offsetStr}
            >
                <div className="stube-container_inner_sticky" style={{ position: 'sticky', top: sceneTop, height: sceneHeight, overflow: 'hidden' }}>
                    {children}
                </div>
            </div>
        </ScrollTubeContext.Provider>
    );
};

export const ScrollTubeCanvas: React.FC<{ project: string; depthtilt?: number | string; width?: string; height?: string; style?: React.CSSProperties }> = ({ project, depthtilt, width = '100%', height = '100%', style }) => {
    const { engine } = useScrollTube();
    const tilt = depthtilt !== undefined ? Number(depthtilt) : 4;

    useEffect(() => {
        if (engine) {
            engine.setDepthTilt(tilt);
        }
    }, [engine, tilt]);

    return (
        <div
            className="stube-canvas"
            data-stube-canvas={project}
            data-stube-depthtilt={tilt}
            style={{ width, height, pointerEvents: 'auto', ...style }}
        >
            {/* CoreOrchestrator will inject the actual <canvas> here */}
        </div>
    );
};

export const ScrollTubeLayer: React.FC<{ align?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ align, style, children }) => {
    return (
        <div
            className="stube-layer"
            data-stube-align={align}
            style={style}
        >
            {children}
        </div>
    );
};

export const ScrollTubeLayerTracking: React.FC<{ id?: string; offset?: { x: number; y: number }; style?: React.CSSProperties; children: React.ReactNode }> = ({ id = 'main', offset = { x: 0, y: 0 }, style, children }) => {
    const context = useContext(ScrollTubeContext);

    // Pre-request tracking data when the component mounts or ID changes
    useEffect(() => {
        if (context?.engine) {
            context.engine.loadTrackingData(id);
        }
    }, [context?.engine, id]);

    if (!context) return null;

    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        // Start centered, CoreOrchestrator will handle the high-frequency top/left updates
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        zIndex: 10,
        ...style,
        // Apply manual offsets via marginTop/marginLeft or similar? 
        // For simplicity, let's just stick to the shared Orchestrator logic
        ...(offset.x !== 0 ? { marginLeft: `${offset.x}px` } : {}),
        ...(offset.y !== 0 ? { marginTop: `${offset.y}px` } : {}),
    };

    return (
        <div className="stube-layer-tracking" data-stube-layer-tracking={id} style={baseStyle}>
            {children}
        </div>
    );
};

// Aliased for backwards compatibility with earlier snippets
export const SubjectLayer = ScrollTubeLayerTracking;

export const useScrollTube = () => {
    const context = useContext(ScrollTubeContext);
    if (!context) throw new Error('useScrollTube must be used within a ScrollTubeProvider');
    return context;
};
