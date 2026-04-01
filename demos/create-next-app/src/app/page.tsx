"use client";

import { ScrollTubeProvider, ScrollTubeCanvas, ScrollTubeLayer, ScrollTubeLayerTracking, useScrollTube } from 'scrolltube/react';

const AppleInfo = () => {
    const { progress, frame } = useScrollTube();
    const opacity = progress > 0.2 && progress < 0.5 ? 1 : 0;

    return (
        <>
            <h2 style={{ fontSize: '3rem', margin: 0, color: "white" }}>Fresh Red Apple</h2>
            <p style={{ opacity: 0.7, color: "white" }}>Tracked with SAM-3 • Frame {frame}</p>
        </>
    );
};

export default function Home() {

    return (
        <main style={{ background: '#8b2222ff', paddingBottom: '100vh' }}>

            {/* Intro section */}
            <section style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <h1>Welcome to ScrollTube</h1>
                <p style={{ position: 'absolute', bottom: '10vh' }}>↓ SCROLL TO EXPLORE</p>
            </section>

            <div style={{ border: "1px solid white" }}>
                {/* The Scroll Sequence */}
                <ScrollTubeProvider
                    //type="sticky" // sticky (in the future we will have also "fixed" or "flow")
                    containerHeight="400vh"
                    //? containerWidth="100%"? unsure if this would work inside a flexbox
                    sceneHeight="100vh" // sticky element height (the height of the "scene" which has the layers and which sticks to the screen while scrolling)
                    sceneTop="0px"
                    offset={["start end", "end end"]} // motion.dev tracking offsets
                    scrub={0.5} // 0 = instant, 1 = 1 second delay before it catches up with scroll
                >
                    {/* Only Layers, or Tracked Layers can be children of the provider, it needs to throw error or type error, or warning when others are being added as child */}
                    <ScrollTubeLayer
                    // normal layer, not tracked, 
                    //align="center-center" // top-left, top-center, top-right, center-left, center-center, center-right, bottom-left, bottom-center, bottom-right (flex container?)
                    >
                        <ScrollTubeCanvas
                            width="100%"
                            height="100%"
                            project="/example-apple-project/scrolltube.json" // moved here because it holds information about the media files that are rendered on the canvas
                            depthtilt={1}
                        // assetId="main-sequence" // (optional?)
                        />
                    </ScrollTubeLayer>

                    <ScrollTubeLayerTracking id="main" offset={{ x: 0, y: 0 }}>
                        <div style={{
                            padding: '12px 24px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '30px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontWeight: 'bold',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}>
                            🍎 Apple Lens Target
                        </div>
                    </ScrollTubeLayerTracking>

                    <ScrollTubeLayer
                        align="bottom-left"
                    >
                        <AppleInfo />
                    </ScrollTubeLayer>


                </ScrollTubeProvider>
            </div>

            {/* Outro section */}
            <section style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <h2>End of sequence</h2>
            </section>

        </main>
    );
}
