import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { state, config, colors } from './appState.js';
import { updateSun } from './environment.js';

// Store scene objects globally for control switching
let sceneObjects = null;

export function getSceneObjects() {
    return sceneObjects;
}

export function switchToMapControls(camera) {
    if (!sceneObjects) return null;

    // Dispose current controls
    if (sceneObjects.controls) {
        sceneObjects.controls.dispose();
    }

    // Create MapControls
    const controls = new MapControls(camera, sceneObjects.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    sceneObjects.controls = controls;
    return controls;
}

export function switchToOrbitControls(camera) {
    if (!sceneObjects) return null;

    // Dispose current controls
    if (sceneObjects.controls) {
        sceneObjects.controls.dispose();
    }

    // Create OrbitControls
    const controls = new OrbitControls(camera, sceneObjects.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 50;
    controls.maxDistance = 2000;

    sceneObjects.controls = controls;
    return controls;
}

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

    // Store for control switching
    sceneObjects = { scene, camera, renderer, controls };

    return sceneObjects;
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
    bloomPass.strength = 0.15;
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
    const time = config.time;

    // Map time (0-24) to Elevation (-90 to 90)
    // 6 AM = 0, 12 PM = 90, 18 PM = 0
    const sunAngle = ((time - 6) / 12) * Math.PI;
    config.elevation = Math.sin(sunAngle) * 90;

    // Optional: Rotate azimuth slightly to make shadows interesting?
    // config.azimuth = 180 + (time - 12) * 10; 

    // Update the Sky/Sun/Water system
    updateSun(scene);

    // Keep the old color lerping for Fog and Ambient/Hemi lights for now
    // as the Sky shader doesn't automatically handle scene fog color.

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

    let skyColor = lerpColor(currentColors.sky, nextColors.sky, alpha);
    let fogColor = lerpColor(currentColors.fog, nextColors.fog, alpha);
    let sunColor = lerpColor(currentColors.sun, nextColors.sun, alpha);
    let ambientColor = lerpColor(currentColors.ambient, nextColors.ambient, alpha);
    let hemiColor = lerpColor(currentColors.hemi, nextColors.hemi, alpha);

    // Season Influence
    const season = config.season;
    if (season > 0) {
        const winterSky = new THREE.Color(0x8899aa);
        const winterFog = new THREE.Color(0xcccccc);
        const winterAmbient = new THREE.Color(0x666666);

        skyColor.lerp(winterSky, season * 0.6);
        fogColor.lerp(winterFog, season * 0.8);
        ambientColor.lerp(winterAmbient, season * 0.4);
    }

    // Sky shader covers background, but we keep this for fallback
    scene.background.copy(skyColor);
    scene.fog.color.copy(fogColor);

    if (state.sunLight) state.sunLight.color.copy(sunColor);
    if (state.ambientLight) state.ambientLight.color.copy(ambientColor);
    if (state.hemisphereLight) state.hemisphereLight.groundColor.copy(hemiColor);

    if (state.fogUniforms) {
        state.fogUniforms.color.value.copy(fogColor);
    }

    // New Water handles its own uniforms via updateSun, removed old manual updates.

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
