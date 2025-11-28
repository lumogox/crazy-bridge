import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { createScene, setupLighting, setupPostProcessing, onWindowResize, updateTimeOfDay } from './scene.js';
import { createVolumetricFog, createWater, createTerrain, createCity, createClouds, updateFog, createPrecipitation, updatePrecipitation, updateTerrain } from './environment.js';
import { createBridge } from './bridge.js';
import { createTraffic, updateTraffic, createShips, updateShips, createBirds, updateBirds, createStreetLights, createParticles, updateParticles } from './dynamic.js';
import { setupUI } from './ui.js';
import { state, config } from './appState.js';
// [CHANGE] Import the disaster module
import { initDisasters, updateDisasters } from './disasters.js';

let scene, camera, renderer, composer, controls, stats;
const clock = new THREE.Clock();

init();
animate();

function init() {
    // Scene Setup
    const sceneObjects = createScene();
    scene = sceneObjects.scene;
    camera = sceneObjects.camera;
    renderer = sceneObjects.renderer;
    controls = sceneObjects.controls;

    // Stats
    stats = new Stats();
    document.body.appendChild(stats.dom);

    // Lighting
    setupLighting(scene);

    // Environment
    createVolumetricFog(scene);
    createWater(scene);
    createBridge(scene);
    createTerrain(scene);
    createCity(scene);

    // Dynamic Elements
    createStreetLights(scene);
    createClouds(scene);
    createPrecipitation(scene);
    createTraffic(scene);
    createShips(scene);
    createBirds(scene);
    createParticles(scene);

    // [CHANGE] Initialize Disasters
    initDisasters(scene);

    // Post-Processing
    composer = setupPostProcessing(scene, camera, renderer);

    // UI
    setupUI(scene, camera);

    // Event Listeners
    window.addEventListener('resize', () => onWindowResize(camera, renderer, composer));

    // Initial update
    updateTimeOfDay(scene);
}

function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const time = performance.now() * 0.001;

    if (state.fogUniforms) {
        state.fogUniforms.time.value = time;
    }
    if (state.water) {
        state.water.material.uniforms.time.value = time;
        state.water.material.uniforms.windSpeed.value = config.windSpeed;
    }

    updateTraffic(dt);
    updateShips(dt);
    updateBirds(dt);
    updateParticles(dt);
    updatePrecipitation(dt);
    updateTerrain();

    // [CHANGE] Update Disasters
    updateDisasters(dt, scene);

    stats.update();
    composer.render();
}
