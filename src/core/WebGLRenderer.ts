export class WebGLRenderer {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private positionBuffer: WebGLBuffer;
    private texture: WebGLTexture;
    private depthTexture: WebGLTexture;

    private targetMouse = { x: 0, y: 0 };
    private currentMouse = { x: 0, y: 0 };
    private animationFrameId: number = 0;
    private depthTilt: number = 0.04;

    constructor(canvas: HTMLCanvasElement, options: { depthTilt?: number } = {}) {
        // Scaling user input (e.g., 1-100) to internal fraction
        this.depthTilt = options.depthTilt !== undefined ? options.depthTilt : 4;
        this.gl = canvas.getContext('webgl', { alpha: false, antialias: false })!;
        if (!this.gl) throw new Error("WebGL not supported");

        const vs = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                // Convert -1 -> 1 to 0 -> 1 for UVs
                v_texCoord = a_position * 0.5 + 0.5;
                v_texCoord.y = 1.0 - v_texCoord.y;
            }
        `;
        const fs = `
            precision mediump float;
            uniform sampler2D u_image;
            uniform sampler2D u_depthMap;
            uniform vec2 u_resolution;
            uniform vec2 u_imageResolution;
            uniform vec2 u_mouse;
            uniform float u_depthTilt;
            uniform bool u_hasDepth;
            varying vec2 v_texCoord;

            void main() {
                // object-fit: cover math
                vec2 ratio = vec2(
                    min((u_resolution.x / u_resolution.y) / (u_imageResolution.x / u_imageResolution.y), 1.0),
                    min((u_resolution.y / u_resolution.x) / (u_imageResolution.y / u_imageResolution.x), 1.0)
                );
                vec2 uv = vec2(
                    v_texCoord.x * ratio.x + (1.0 - ratio.x) * 0.5,
                    v_texCoord.y * ratio.y + (1.0 - ratio.y) * 0.5
                );

                if (u_hasDepth) {
                    float depth = texture2D(u_depthMap, uv).r;
                    // White is close (1), Black is far (0).
                    // By making the background move and the foreground stay still (using 1.0 - depth)
                    // and subtracting the parallax, the background pulls the foreground over itself,
                    // expanding the edges and creating proper occlusion, instead of collapsing/tearing.
                    // depthTilt is scaled by 0.01 internally (so 100 = 1.0 peak displacement)
                    vec2 parallax = u_mouse * (1.0 - depth) * (u_depthTilt * 0.01);
                    uv -= parallax;
                }
                
                gl_FragColor = texture2D(u_image, uv);
            }
        `;

        this.program = this.createProgram(vs, fs)!;
        this.gl.useProgram(this.program);

        this.positionBuffer = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), this.gl.STATIC_DRAW);

        this.texture = this.gl.createTexture()!;
        this.depthTexture = this.gl.createTexture()!;

        window.addEventListener('mousemove', (e) => {
            this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = (e.clientY / window.innerHeight) * 2 - 1;
        });

        this.animate();
    }

    public setDepthTilt(tilt: number) {
        this.depthTilt = tilt;
    }

    private createProgram(vsSource: string, fsSource: string) {
        const vs = this.gl.createShader(this.gl.VERTEX_SHADER)!;
        this.gl.shaderSource(vs, vsSource);
        this.gl.compileShader(vs);

        const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER)!;
        this.gl.shaderSource(fs, fsSource);
        this.gl.compileShader(fs);

        const program = this.gl.createProgram()!;
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        return program;
    }

    private animate = () => {
        // Smooth mouse interpolation
        this.currentMouse.x += (this.targetMouse.x - this.currentMouse.x) * 0.1;
        this.currentMouse.y += (this.targetMouse.y - this.currentMouse.y) * 0.1;

        if (this.gl && this.program) {
            this.gl.useProgram(this.program);
            const loc = this.gl.getUniformLocation(this.program, "u_mouse");
            this.gl.uniform2f(loc, this.currentMouse.x, this.currentMouse.y);
            
            const tiltLoc = this.gl.getUniformLocation(this.program, "u_depthTilt");
            this.gl.uniform1f(tiltLoc, this.depthTilt);
            // Re-draw with updated mouse
            this.draw();
        }
        this.animationFrameId = requestAnimationFrame(this.animate);
    }

    public render(img: HTMLImageElement, depthImg: HTMLImageElement | null, width: number, height: number) {
        this.gl.useProgram(this.program);

        // Update main texture
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);

        // Update depth texture
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.depthTexture);
        if (depthImg) {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, depthImg);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        }

        // Set Uniforms
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, "u_image"), 0);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, "u_depthMap"), 1);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, "u_hasDepth"), depthImg ? 1 : 0);
        this.gl.uniform2f(this.gl.getUniformLocation(this.program, "u_resolution"), width, height);
        this.gl.uniform2f(this.gl.getUniformLocation(this.program, "u_imageResolution"), img.naturalWidth, img.naturalHeight);

        // Set Attributes
        const posLoc = this.gl.getAttribLocation(this.program, "a_position");
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.viewport(0, 0, width, height);
        this.draw();
    }

    private draw() {
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    public destroy() {
        cancelAnimationFrame(this.animationFrameId);
    }
}
