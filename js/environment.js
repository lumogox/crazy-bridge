import * as THREE from 'three';
import { state, config } from './appState.js';
console.log("Environment module loaded, config:", config);

function createFogTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)'); // Softer start
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

export function createVolumetricFog(scene) {
    const particleCount = 6000;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    const sizes = [];

    for (let i = 0; i < particleCount; i++) {
        const x = (Math.random() - 0.5) * 4000;
        const y = Math.random() * 200; // Low lying fog
        const z = (Math.random() - 0.5) * 4000;
        positions.push(x, y, z);

        velocities.push((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5);
        sizes.push(200 + Math.random() * 300);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    state.fogUniforms = {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        map: { value: createFogTexture() },
        opacity: { value: (config.fogDensity / 100) * 0.02 }
    };

    const material = new THREE.ShaderMaterial({
        uniforms: state.fogUniforms,
        vertexShader: `
            uniform float time;
            attribute float size;
            attribute vec3 velocity;
            varying float vOpacity;
            void main() {
                vec3 pos = position;
                // Drift
                pos.x += velocity.x * time * 0.1;
                pos.z += velocity.z * time * 0.1;
                pos.y += sin(time * 0.5 + pos.x * 0.01) * 5.0; // Bob

                // Wrap around
                if(pos.x > 2000.0) pos.x -= 4000.0;
                if(pos.x < -2000.0) pos.x += 4000.0;
                if(pos.z > 2000.0) pos.z -= 4000.0;
                if(pos.z < -2000.0) pos.z += 4000.0;

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (1000.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
                
                // Fade out near camera
                float dist = length(mvPosition.xyz);
                vOpacity = smoothstep(0.0, 500.0, dist);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform sampler2D map;
            uniform float opacity;
            varying float vOpacity;
            void main() {
                vec4 texColor = texture2D(map, gl_PointCoord);
                if (texColor.a < 0.1) discard;
                gl_FragColor = vec4(color, texColor.a * opacity * vOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    state.fogSystem = new THREE.Points(geometry, material);
    scene.add(state.fogSystem);
}

export function createWater(scene) {
    const geometry = new THREE.PlaneGeometry(10000, 10000, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    const waterUniforms = {
        time: { value: 0 },
        sunPosition: { value: new THREE.Vector3() },
        waterColor: { value: new THREE.Color(0x001e0f) },
        skyColor: { value: new THREE.Color(0x87CEEB) },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogDensity: { value: 0.002 },
        windSpeed: { value: 1.0 }
    };

    const material = new THREE.ShaderMaterial({
        uniforms: waterUniforms,
        vertexShader: `
            uniform float time;
            uniform float windSpeed;
            varying vec3 vWorldPosition;
            varying vec3 vViewPosition;
            varying vec3 vNormal;

            // Simple noise function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }
            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                
                vec3 pos = position;
                // Waves
                float waveAmp = 1.0 + windSpeed * 0.5;
                float waveFreq = 1.0 + windSpeed * 0.2;
                
                float wave1 = sin(pos.x * 0.01 * waveFreq + time * waveFreq) * 2.0 * waveAmp;
                float wave2 = cos(pos.z * 0.01 * waveFreq + time * 0.8 * waveFreq) * 2.0 * waveAmp;
                float wave3 = noise(pos.xz * 0.02 + time * waveFreq) * 3.0 * waveAmp;
                
                pos.y += wave1 + wave2 + wave3;
                
                // Approximate normal
                vec3 n = vec3(0.0, 1.0, 0.0);
                n.x = -cos(pos.x * 0.01 * waveFreq + time * waveFreq) * 0.05 * waveAmp;
                n.z = sin(pos.z * 0.01 * waveFreq + time * 0.8 * waveFreq) * 0.05 * waveAmp;
                vNormal = normalize(n);

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 sunPosition;
            uniform vec3 waterColor;
            uniform vec3 skyColor;
            uniform vec3 fogColor;
            uniform float fogDensity;
            
            varying vec3 vWorldPosition;
            varying vec3 vViewPosition;
            varying vec3 vNormal;

            void main() {
                vec3 viewDir = normalize(vViewPosition);
                vec3 normal = normalize(vNormal);
                vec3 sunDir = normalize(sunPosition);

                // Specular
                vec3 halfVector = normalize(sunDir + viewDir);
                float NdotH = max(0.0, dot(normal, halfVector));
                float specular = pow(NdotH, 100.0);

                // Fresnel
                float fresnel = 0.02 + 0.98 * pow(1.0 - dot(viewDir, normal), 5.0);

                // Mix water and sky
                vec3 finalColor = mix(waterColor, skyColor, fresnel);
                finalColor += vec3(specular);

                // Fog (Distance based)
                float dist = length(vViewPosition);
                float fogFactor = 1.0 - exp(-dist * dist * fogDensity * fogDensity);
                
                gl_FragColor = vec4(mix(finalColor, fogColor, fogFactor), 1.0);
            }
        `
    });

    state.water = new THREE.Mesh(geometry, material);
    state.water.position.y = -10; // Slightly below 0 to allow bridge piers to stick out
    scene.add(state.water);
}

export function createTerrain(scene) {
    const geometry = new THREE.PlaneGeometry(5000, 5000, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);

        let h = 0;
        if (vertex.x > 1400) {
            const d = vertex.x - 1400;
            h = Math.sin(d * 0.005) * 100 + Math.random() * 10 + d * 0.2;
            h += Math.sin(vertex.z * 0.005) * 50;
        } else if (vertex.x < -1400) {
            const d = -1400 - vertex.x;
            h = Math.sin(d * 0.005) * 50 + Math.random() * 5 + d * 0.1;
        } else {
            h = -50;
        }

        h += Math.random() * 5;

        vertex.y = Math.max(-50, h);
        positionAttribute.setY(i, vertex.y);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0x556633,
        flatShading: true,
        roughness: 0.8
    });

    state.terrain = new THREE.Mesh(geometry, material);
    state.terrain.receiveShadow = true;
    scene.add(state.terrain);
}

export function updateTerrain() {
    if (!state.terrain) return;

    const season = config.season;
    const material = state.terrain.material;

    const summerColor = new THREE.Color(0x556633);
    const autumnColor = new THREE.Color(0x8B4513);
    const winterColor = new THREE.Color(0xFFFFFF);

    let targetColor;
    if (season < 0.5) {
        // Summer -> Autumn
        const t = season * 2;
        targetColor = summerColor.lerp(autumnColor, t);
    } else {
        // Autumn -> Winter
        const t = (season - 0.5) * 2;
        targetColor = autumnColor.lerp(winterColor, t);
    }

    material.color.copy(targetColor);
}

export function createCity(scene) {
    const cityGroup = new THREE.Group();
    scene.add(cityGroup);

    state.cityMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, emissive: 0x000000 });
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    const buildings = [];
    for (let i = 0; i < 200; i++) {
        const x = -1500 - Math.random() * 1000;
        const z = (Math.random() - 0.5) * 2000;
        const h = 50 + Math.random() * 150;
        const w = 20 + Math.random() * 30;
        const d = 20 + Math.random() * 30;

        buildings.push({ x: x, y: h / 2, z: z, sx: w, sy: h, sz: d });
    }

    const mesh = new THREE.InstancedMesh(geometry, state.cityMaterial, buildings.length);
    const dummy = new THREE.Object3D();

    buildings.forEach((b, i) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.set(b.sx, b.sy, b.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cityGroup.add(mesh);
}

export function createClouds(scene) {
    const count = 1000;
    const geometry = new THREE.BoxGeometry(15, 10, 15); // Slightly smaller voxels
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        transparent: true,
        opacity: 0.9
    });

    state.cloudMesh = new THREE.InstancedMesh(geometry, material, count);
    state.cloudMesh.castShadow = true;
    state.cloudMesh.receiveShadow = false;
    scene.add(state.cloudMesh);

    const dummy = new THREE.Object3D();

    // Cluster Logic
    const numClusters = 40;
    let idx = 0;

    for (let c = 0; c < numClusters; c++) {
        // Cluster center
        const cx = (Math.random() - 0.5) * 4000;
        const cy = 250 + Math.random() * 100;
        const cz = (Math.random() - 0.5) * 4000;
        const clusterSize = 10 + Math.floor(Math.random() * 20); // particles per cluster

        for (let p = 0; p < clusterSize; p++) {
            if (idx >= count) break;

            // Gaussian-ish offset
            const ox = (Math.random() - 0.5) * 150;
            const oy = (Math.random() - 0.5) * 40;
            const oz = (Math.random() - 0.5) * 150;

            const x = cx + ox;
            const y = cy + oy;
            const z = cz + oz;

            state.clouds.push({ x, y, z, speed: 2 + Math.random() * 2 }); // Store initial pos

            dummy.position.set(x, y, z);
            // Random scale for variety
            const s = 1 + Math.random();
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            state.cloudMesh.setMatrixAt(idx++, dummy.matrix);
        }
    }
}

export function updateFog(scene) {
    const density = config.fogDensity / 100; // 0 to 1
    if (state.fogSystem) {
        state.fogSystem.visible = density > 0.0;
        if (state.fogUniforms) {
            state.fogUniforms.opacity.value = density * 0.02; // Reduced textured fog
        }
    }

    // Also update standard fog for distance
    const fogDensity = density * 0.004; // Increased base smooth fog
    scene.fog.density = fogDensity;

    // Update Water Fog
    if (state.water) {
        state.water.material.uniforms.fogDensity.value = fogDensity;
    }
}

export function createPrecipitation(scene) {
    const count = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
        positions.push((Math.random() - 0.5) * 3000, Math.random() * 1000, (Math.random() - 0.5) * 3000);
        velocities.push(0, -1, 0); // Base velocity
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));

    const material = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    state.precipitationSystem = new THREE.Points(geometry, material);
    state.precipitationSystem.visible = false;
    scene.add(state.precipitationSystem);
}

export function updatePrecipitation(dt) {
    if (!state.precipitationSystem) return;

    const intensity = config.weatherIntensity;
    if (intensity <= 0.01) {
        state.precipitationSystem.visible = false;
        return;
    }

    state.precipitationSystem.visible = true;
    const positions = state.precipitationSystem.geometry.attributes.position.array;
    const count = positions.length / 3;

    // Determine type based on season (simple temp proxy)
    // Season 0.8+ is winter/snow
    const isSnow = config.season > 0.75;

    // Update material appearance
    const material = state.precipitationSystem.material;
    if (isSnow) {
        material.color.setHex(0xffffff);
        material.size = 4;
        material.opacity = 0.8 * intensity;
    } else {
        material.color.setHex(0xaaaaaa);
        material.size = 2;
        material.opacity = 0.6 * intensity;
    }

    const wind = config.windDirection.clone().multiplyScalar(config.windSpeed * (isSnow ? 5 : 2));
    const fallSpeed = isSnow ? 50 : 200;

    for (let i = 0; i < count; i++) {
        let x = positions[i * 3];
        let y = positions[i * 3 + 1];
        let z = positions[i * 3 + 2];

        // Movement
        x += wind.x * dt;
        y -= fallSpeed * dt;
        z += wind.z * dt;

        // Noise/Turbulence for snow
        if (isSnow) {
            x += Math.sin(y * 0.05 + Date.now() * 0.001) * 20 * dt;
            z += Math.cos(y * 0.05 + Date.now() * 0.001) * 20 * dt;
        }

        // Wrap
        if (y < -50) y = 1000;
        if (x > 1500) x -= 3000;
        if (x < -1500) x += 3000;
        if (z > 1500) z -= 3000;
        if (z < -1500) z += 3000;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    state.precipitationSystem.geometry.attributes.position.needsUpdate = true;
}
