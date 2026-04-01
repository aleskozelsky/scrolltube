import { CoreEngine } from './CoreEngine';
import { CoreOrchestrator } from './CoreOrchestrator';

export * from './types';
export { CoreEngine } from './CoreEngine';
export * from './WebGLRenderer';
export { CoreOrchestrator } from './CoreOrchestrator';

// Attach for dot-access in UMD/Vanilla environments
const ScrollTube = Object.assign(CoreEngine, {
    CoreOrchestrator
});

export default ScrollTube;

