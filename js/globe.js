// js/globe.js — v8: Rotación constante + Malla pulsante (Sin repulsión)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

const canvas = document.getElementById('hero-globe');
if (canvas) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x05070a, 0); 
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 6;

    const group = new THREE.Group();
    group.rotation.x = -0.28;
    scene.add(group);

    // ---------- GPGPU: física de partículas en el GPU ----------
    const WIDTH = 96; 
    const gpu = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
    if (renderer.capabilities.isWebGL2 === false) gpu.setDataType(THREE.HalfFloatType);

    const dtPos = gpu.createTexture();
    const dtVel = gpu.createTexture();
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const GA = Math.PI * (3 - Math.sqrt(5));
    
    for (let i = 0; i < WIDTH * WIDTH; i++) {
        const y = 1 - (i / (WIDTH * WIDTH - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const t = GA * i;
        const rad = 1 + (rnd() - 0.5) * 0.28;
        dtPos.image.data[i * 4 + 0] = Math.cos(t) * r * rad;
        dtPos.image.data[i * 4 + 1] = y * rad;
        dtPos.image.data[i * 4 + 2] = Math.sin(t) * r * rad;
        dtPos.image.data[i * 4 + 3] = rad; 
        dtVel.image.data[i * 4 + 0] = (rnd() - 0.5) * 0.0005;
        dtVel.image.data[i * 4 + 1] = (rnd() - 0.5) * 0.0005;
        dtVel.image.data[i * 4 + 2] = (rnd() - 0.5) * 0.0005;
        dtVel.image.data[i * 4 + 3] = 1;
    }

    const homeTex = new THREE.DataTexture(dtPos.image.data, WIDTH, WIDTH, THREE.RGBAFormat, THREE.FloatType);
    homeTex.needsUpdate = true;

    const posVar = gpu.addVariable('texturePosition', `
        void main(){
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec4 pd = texture2D(texturePosition, uv);
            vec3 vel = texture2D(textureVelocity, uv).xyz;
            gl_FragColor = vec4(pd.xyz + vel, pd.w);
        }`, dtPos);

    // Ajustado: Solo turbulencia, sin interacción con ratón
    const velVar = gpu.addVariable('textureVelocity', `
        uniform float uTime;
        uniform sampler2D uHome;
        
        void main(){
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec3 pos = texture2D(texturePosition, uv).xyz;
            vec3 vel = texture2D(textureVelocity, uv).xyz;
            vec3 home = texture2D(uHome, uv).xyz;

            vec3 dir = normalize(pos + vec3(0.0001));

            // Ruido orgánico
            vec3 n = vec3(
                sin(pos.y * 3.1 + uTime * 0.6) * cos(pos.z * 2.7 + uTime * 0.4),
                sin(pos.z * 3.3 + uTime * 0.5) * cos(pos.x * 2.9 + uTime * 0.7),
                sin(pos.x * 3.7 + uTime * 0.8) * cos(pos.y * 2.3 + uTime * 0.5));
            vec3 nt = n - dir * dot(n, dir);
            vec3 swirl = cross(vec3(0.0, 1.0, 0.0), dir);

            // Suma de fuerzas: ruido + resorte al origen
            vec3 F = nt * 0.0008 + swirl * 0.0003 + (home - pos) * 0.02;

            vel = vel * 0.90 + F; 
            vel = clamp(vel, vec3(-0.01), vec3(0.01)); 
            gl_FragColor = vec4(vel, 1.0);
        }`, dtVel);

    gpu.setVariableDependencies(posVar, [posVar, velVar]);
    gpu.setVariableDependencies(velVar, [posVar, velVar]);
    
    posVar.material.uniforms.uTime = { value: 0 };
    velVar.material.uniforms.uTime = { value: 0 };
    velVar.material.uniforms.uHome = { value: homeTex };
    
    const gpuError = gpu.init();
    if (gpuError) console.error('GPGPU:', gpuError);

    // ---------- Shader Material de Partículas ----------
    const COUNT = WIDTH * WIDTH;
    const geo = new THREE.BufferGeometry();
    const dummy = new Float32Array(COUNT * 3);
    const reference = new Float32Array(COUNT * 2);
    const aSize = new Float32Array(COUNT);
    const aPhase = new Float32Array(COUNT);
    const aBright = new Float32Array(COUNT);
    
    for (let i = 0; i < COUNT; i++) {
        reference[i * 2] = (i % WIDTH) / WIDTH;
        reference[i * 2 + 1] = Math.floor(i / WIDTH) / WIDTH;
        aSize[i] = 0.8 + rnd() * 1.5; 
        aPhase[i] = rnd();
        aBright[i] = rnd() > 0.94 ? 1 : 0;
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(dummy, 3));
    geo.setAttribute('reference', new THREE.BufferAttribute(reference, 2));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));

    const clustersU = { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)] };
    
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uDpr: { value: 1 },
            uPosTex: { value: null },
            uColor: { value: new THREE.Color(0x0066ff) },  
            uBright: { value: new THREE.Color(0xffffff) }, 
            uPink: { value: new THREE.Color(0xff0066) },   
            uC: clustersU
        },
        vertexShader: `
            attribute vec2 reference;
            attribute float aSize; attribute float aPhase; attribute float aBright;
            uniform sampler2D uPosTex;
            uniform float uTime; uniform float uDpr; uniform vec3 uC[3];
            varying float vTw; varying float vBright; varying float vM;
            void main(){
                vec3 p = texture2D(uPosTex, reference).xyz;
                vBright = aBright;
                vTw = 0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 2.0) + aPhase * 17.0);
                vec3 dir = normalize(p);
                float m = 0.0;
                for (int i = 0; i < 3; i++) m = max(m, smoothstep(0.90, 1.0, dot(dir, uC[i])));
                vM = m;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = aSize * uDpr * (1.0 + 0.8 * vTw) * (6.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform vec3 uColor; uniform vec3 uBright; uniform vec3 uPink;
            varying float vTw; varying float vBright; varying float vM;
            void main(){
                float d = length(gl_PointCoord - 0.5);
                float core = smoothstep(0.5, 0.0, d);
                float alpha = core * (0.20 + 0.80 * vTw);
                vec3 col = mix(uColor, uBright, vBright * vTw);
                col = mix(col, uPink, vM);
                
                gl_FragColor = vec4(col * 1.5, min(alpha * (1.0 + vM), 1.0));
            }`
    });
    group.add(new THREE.Points(geo, mat));

    // ---------- Efecto de Profundidad (Ocultar parte trasera) ----------
    scene.fog = new THREE.Fog(0x000000, 4.5, 6.5);

    // ---------- Geometría Base ----------
    const shellGeo = new THREE.IcosahedronGeometry(1.32, 2);
    const shellWire = new THREE.WireframeGeometry(shellGeo);
    
    // ---------- Material de las LÍNEAS del escáner ----------
    const shellMat = new THREE.ShaderMaterial({ 
        transparent: true, 
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0xddeeff) }
        },
        vertexShader: `
            varying float vY;
            varying float vZ; 
            void main() {
                // Convertimos la posición local a coordenadas globales (del mundo)
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                
                vY = worldPosition.y; // Eje Y global: el barrido siempre es vertical
                vZ = worldPosition.z; // Eje Z global: el frente siempre apunta a la cámara
                
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 uColor; uniform float uTime; 
            varying float vY;
            varying float vZ;
            void main() {
                float t = mod(uTime, 5.0); 
                float sweep = 1.5 - (t * 1.5); 
                float dist = abs(vY - sweep);
                
                float glow = exp(-dist * 12.0); 
                float frontMask = smoothstep(-0.2, 0.8, vZ);
                
                float opacity = (0.01 + glow * 1.0) * frontMask; 
                
                // Reducimos la sobreexposición de 12.0 a un punto medio equilibrado: 5.0
                // Así destaca nítidamente sobre el fondo azul, pero sin saturar la imagen.
                gl_FragColor = vec4(uColor * (1.0 + glow * 5.0), opacity);
            }
        `
    });
    const shell = new THREE.LineSegments(shellWire, shellMat);
    group.add(shell);

    // ---------- Post-procesado: BLOOM CINEMATOGRÁFICO ----------
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    renderPass.clearColor = new THREE.Color(0x000000);
    renderPass.clearAlpha = 0;
    composer.addPass(renderPass);
    
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        2.2,  
        0.5,  
        0.1   
    );
    composer.addPass(bloom);

    // ---------- Resize ----------
    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(rect.width, rect.height, false);
        composer.setSize(rect.width, rect.height);
        
        bloom.resolution.set(rect.width, rect.height);
        
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        mat.uniforms.uDpr.value = dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // ---------- Animación y Lógica de Deriva ----------
    const hubs = [
        { lat: 20, lon: 0, dlon: 1.5, ph: 0 },
        { lat: -10, lon: 120, dlon: 2.2, ph: 2.4 },
        { lat: 30, lon: 240, dlon: 1.1, ph: 4.8 }
    ];
    const toVec = (la, lo) => {
        const lat = la * Math.PI / 180, lon = lo * Math.PI / 180;
        return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    };

    const tick = (t) => {
        const ts = t / 1000;
        
        // 1. Rotación Constante de toda la esfera (efecto Planeta)
        group.rotation.y = ts * 0.08;  // Controla la velocidad de giro global aquí
        
        // 2. Actualizar GPGPU
        posVar.material.uniforms.uTime.value = ts;
        velVar.material.uniforms.uTime.value = ts;
        gpu.compute();
        
        // 3. Actualizar Material Visual
        mat.uniforms.uTime.value = ts;
        mat.uniforms.uPosTex.value = gpu.getCurrentRenderTarget(posVar).texture;
        
        // 4. Lógica de barrido de la malla (Shader)
        shellMat.uniforms.uTime.value = ts; 
        
        // Rotación independiente de la red
        shell.rotation.y = -ts * 0.02;

        hubs.forEach((h, k) => {
            clustersU.value[k].copy(toVec(h.lat + Math.sin(ts * 0.2 + h.ph) * 20, h.lon + ts * h.dlon));
        });
        
        composer.render();
    };

    if (reduced) tick(1200);
    else renderer.setAnimationLoop(tick);
}