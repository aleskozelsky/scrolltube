# WordPress Gutenberg Block Implementation 

## Blocks: 

### 1. ScrollTube Block
Main block. It accepts only "Layer" block instances

**Attributes**
- `project`: Path to the scrolltube.json file
- `containerHeight`: Height of the scroll container
- `canvasHeight`: Height of the scroll canvas
- `offset`: Offset for the scroll container
- `scrub`: Scrub value for the scroll container

### 2. Layer Block
Has two types of layers:
- Subject Layer: When we have a subject in the input video, and we have tracked it
- Layer: When we do not have a tracked subject, and we want to animate using keyframes relative to the main timeline

#### Subject Layer
**Attributes**
- `id`: ID of the subject
- `offset`: Offset for the subject
- `scrub`: Scrub value for the subject

#### Layer Block
**Attributes**
- `align`: Alignment of the layer
- `start`: Start position of the layer
- `end`: End position of the layer
- `keyframes`: Keyframes for the layer

#### Content Animation (nested inside Layer block)
Content animation allows you to animate the content of the layer based on events like "onScroll", "onHover", etc.

## WordPress Implementation Example

Below is a conceptual implementation of how to wrap the `scrolltube` core engine into a WordPress Gutenberg block. This follows the standard "Dynamic Block" pattern.

### 1. block.json (Main Container)
```json
{
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "scrolltube/container",
    "title": "ScrollTube Container",
    "category": "design",
    "attributes": {
        "projectUrl": { "type": "string" },
        "containerHeight": { "type": "string", "default": "400vh" },
        "canvasHeight": { "type": "string", "default": "100vh" },
        "scrub": { "type": "number", "default": 0.1 }
    },
    "supports": { "align": ["full"], "html": false },
    "viewScript": "file:./view.js"
}
```

### 2. render.php (Server Side)
```php
<?php
/**
 * Render for ScrollTube Main Block
 */
$wrapper_attributes = get_block_wrapper_attributes([
    'class' => 'stube-main-block',
    'style' => 'height: ' . $attributes['containerHeight'],
    'data-project' => $attributes['projectUrl'],
    'data-scrub' => $attributes['scrub']
]);
?>
<div <?php echo $wrapper_attributes; ?>>
    <div class="stube-sticky-wrap" style="position: sticky; top: 0; height: <?php echo $attributes['canvasHeight']; ?>; overflow: hidden;">
        <canvas class="stube-canvas" style="width: 100%; height: 100%; object-fit: cover;"></canvas>
        <div class="stube-layers-content" style="position: absolute; inset: 0;">
            <?php echo $content; ?>
        </div>
    </div>
</div>
```

### 3. view.js (Frontend Initialization)
Uses the `scrolltube` package directly.

```javascript
import { CoreEngine } from 'scrolltube';
import { scroll } from 'motion';

const initScrollTube = async (el) => {
    const configUrl = el.dataset.project;
    const scrub = parseFloat(el.dataset.scrub || 0);
    const canvas = el.querySelector('.stube-canvas');
    
    // Initialize Core Engine
    const engine = await CoreEngine.init(el, configUrl);
    engine.scrub = scrub;

    // Handle Subject Layers inside this container
    const subjectLayers = el.querySelectorAll('[data-stube-subject]');
    
    engine.onFrameChange = (frame) => {
        subjectLayers.forEach(async (layer) => {
            const subjectId = layer.dataset.stubeSubject;
            await engine.loadTrackingData(subjectId);
            const coords = engine.getTrackedCoords(subjectId, frame);
            
            // Apply coordinates to the subject layer
            layer.style.left = `${coords.x * 100}%`;
            layer.style.top = `${coords.y * 100}%`;
            layer.style.transform = `translate(-50%, -50%)`;
        });
    };

    // Integrate with Motion's scroll for progress
    scroll((progress) => {
        engine.update(progress);
    }, {
        target: el,
        offset: ["start end", "end start"]
    });
};

// Initialize all blocks on the page
document.querySelectorAll('.stube-main-block').forEach(initScrollTube);
```

### 4. Subject Layer (Inner Block)
A simple block that provides the `data-stube-subject` attribute for the `view.js` to find.

```php
<div class="stube-subject-layer" 
     data-stube-subject="<?php echo $attributes['subjectId']; ?>"
     style="position: absolute; pointer-events: auto;">
    <?php echo $content; ?>
</div>
```





