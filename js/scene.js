import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { state, params, colors } from './state.js';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(500, 200, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 50;
    controls.maxDistance = 2000;

    return { scene, camera, renderer, controls };
}

export function setupLighting(scene) {
    state.ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(state.ambientLight);

    state.hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
    scene.add(state.hemisphereLight);

    state.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    state.sunLight.position.set(100, 500, 100);
    state.sunLight.castShadow = true;
    state.sunLight.shadow.mapSize.width = 2048;
    state.sunLight.shadow.mapSize.height = 2048;
    state.sunLight.shadow.camera.near = 0.5;
    state.sunLight.shadow.camera.far = 3000;
    const d = 1500;
    state.sunLight.shadow.camera.left = -d;
    state.sunLight.shadow.camera.right = d;
    state.sunLight.shadow.camera.top = d;
    state.sunLight.shadow.camera.bottom = -d;
    scene.add(state.sunLight);
}

export function setupPostProcessing(scene, camera, renderer) {
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.5;
    bloomPass.strength = 0.3;
    bloomPass.radius = 0.2;

    const outputPass = new OutputPass();

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    return composer;
}

export function onWindowResize(camera, renderer, composer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function lerpColor(color1, color2, alpha) {
    return color1.clone().lerp(color2, alpha);
}

export function updateTimeOfDay(scene) {
    const time = params.time;
    const angle = (time / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = 1000;

    if (state.sunLight) {
        state.sunLight.position.x = Math.cos(angle) * radius;
        state.sunLight.position.y = Math.sin(angle) * radius;
        state.sunLight.position.z = 500;
    }

    // Determine phase
    let currentColors = colors.noon;
    let nextColors = colors.noon;
    let alpha = 0;

    if (time >= 0 && time < 6) { // Night -> Dawn
        currentColors = colors.night;
        nextColors = colors.dawn;
        alpha = time / 6;
    } else if (time >= 6 && time < 12) { // Dawn -> Noon
        currentColors = colors.dawn;
        nextColors = colors.noon;
        alpha = (time - 6) / 6;
    } else if (time >= 12 && time < 18) { // Noon -> Dusk
        currentColors = colors.noon;
        nextColors = colors.dusk;
        alpha = (time - 12) / 6;
    } else { // Dusk -> Night
        currentColors = colors.dusk;
        nextColors = colors.night;
        alpha = (time - 18) / 6;
    }

    const skyColor = lerpColor(currentColors.sky, nextColors.sky, alpha);
    const fogColor = lerpColor(currentColors.fog, nextColors.fog, alpha);
    const sunColor = lerpColor(currentColors.sun, nextColors.sun, alpha);
    const ambientColor = lerpColor(currentColors.ambient, nextColors.ambient, alpha);
    const hemiColor = lerpColor(currentColors.hemi, nextColors.hemi, alpha);

    scene.background.copy(skyColor);
    scene.fog.color.copy(fogColor);
    if (state.sunLight) state.sunLight.color.copy(sunColor);
    if (state.ambientLight) state.ambientLight.color.copy(ambientColor);
    if (state.hemisphereLight) state.hemisphereLight.groundColor.copy(hemiColor);

    if (state.fogUniforms) {
        state.fogUniforms.color.value.copy(fogColor);
    }

    if (state.water) {
        state.water.material.uniforms.sunPosition.value.copy(state.sunLight.position);
        state.water.material.uniforms.skyColor.value.copy(skyColor);
        state.water.material.uniforms.fogColor.value.copy(fogColor);
    }

    // Intensity adjustments
    if (state.sunLight) {
        if (time < 6 || time > 18) {
            state.sunLight.intensity = 0.1;
        } else {
            state.sunLight.intensity = 3 * Math.sin((time - 6) / 12 * Math.PI); // Peak at noon
        }
    }

    // Night Mode Logic
    const isNight = time < 6 || time > 18;
    if (isNight) {
        if (state.cityMaterial) state.cityMaterial.emissive.setHex(0x555555);
        state.towerBeacons.forEach(b => b.intensity = 1);
    } else {
        if (state.cityMaterial) state.cityMaterial.emissive.setHex(0x000000);
        state.towerBeacons.forEach(b => b.intensity = 0);
    }
}
