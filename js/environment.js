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

import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

export function createWater(scene) {
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

    const loader = new THREE.TextureLoader();
    const waterNormals = loader.load('textures/waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    });

    state.water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: waterNormals,
            sunDirection: new THREE.Vector3(),
            sunColor: config.sunColor,
            waterColor: config.waterColor,
            distortionScale: config.waterDistortionScale,
            fog: scene.fog !== undefined
        }
    );

    state.water.rotation.x = - Math.PI / 2;
    state.water.position.y = -10; // Keep existing height adjustment

    scene.add(state.water);
}

export function createSky(scene, renderer) {
    state.sky = new Sky();
    state.sky.scale.setScalar(10000);
    scene.add(state.sky);

    const skyUniforms = state.sky.material.uniforms;

    skyUniforms['turbidity'].value = config.turbidity;
    skyUniforms['rayleigh'].value = config.rayleigh;
    skyUniforms['mieCoefficient'].value = config.mieCoefficient;
    skyUniforms['mieDirectionalG'].value = config.mieDirectionalG;

    state.pmremGenerator = new THREE.PMREMGenerator(renderer);
    state.sceneEnv = new THREE.Scene();
}

export function updateSun(scene) {
    if (!state.sky || !state.water || !state.pmremGenerator) return;

    const phi = THREE.MathUtils.degToRad(90 - config.elevation);
    const theta = THREE.MathUtils.degToRad(config.azimuth);

    const sun = new THREE.Vector3();
    sun.setFromSphericalCoords(1, phi, theta);

    state.sky.material.uniforms['sunPosition'].value.copy(sun);
    state.water.material.uniforms['sunDirection'].value.copy(sun).normalize();

    // Update water color dynamically
    state.water.material.uniforms['waterColor'].value.setHex(config.waterColor);

    // Also update our main directional light to match
    if (state.sunLight) {
        state.sunLight.position.copy(sun).multiplyScalar(1000);
    }

    if (state.renderTarget) state.renderTarget.dispose();

    state.sceneEnv.add(state.sky);
    state.renderTarget = state.pmremGenerator.fromScene(state.sceneEnv);
    state.sceneEnv.remove(state.sky); // Clean up for next frame

    scene.environment = state.renderTarget.texture;
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
    state.cityGroup = new THREE.Group();
    scene.add(state.cityGroup);

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
    state.cityGroup.add(mesh);
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
    // Skip fog override when in city mode (city scenario has its own fog)
    if (state.cityMode) return;

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
