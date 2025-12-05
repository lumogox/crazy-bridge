import * as THREE from 'three';
import { Scenario } from './Scenario.js';
import { createBridge, bridgeVoxelMap, bridgeGroup } from '../bridge.js';
import { createVolumetricFog, createWater, createSky, createTerrain, createCity, createClouds } from '../environment.js';
import { createStreetLights, createShips, createBirds, cleanupTraffic } from '../dynamic.js';
import { state } from '../appState.js';

export class GoldenBridgeScenario extends Scenario {
    constructor() {
        super();
        this.name = "Golden Gate Bridge";
    }

    init(scene, renderer) {
        super.init(scene);
        createVolumetricFog(scene);
        createSky(scene, renderer);
        createWater(scene);
        createTerrain(scene);
        createBridge(scene);
        createCity(scene);
        createStreetLights(scene);
        createClouds(scene);
        createShips(scene);
        createBirds(scene);
    }

    update(dt) {
        // Bridge doesn't have specific update logic in the old code, 
        // it was static except for destruction which is handled globally or in dynamic.js
    }

    getTrafficConfig() {
        return {
            count: 400,
            length: 3000,
            y: 69,
            groundCheck: true, // Enable voxel ground check
            lanes: [
                { z: -25, dir: 1 },
                { z: -15, dir: 1 },
                { z: -5, dir: 1 },
                { z: 5, dir: -1 },
                { z: 15, dir: -1 },
                { z: 25, dir: -1 }
            ]
        };
    }

    cleanup(scene) {
        // Remove Environment
        if (state.water) { scene.remove(state.water); state.water = null; }
        if (state.sky) { scene.remove(state.sky); state.sky = null; }
        if (state.terrain) { scene.remove(state.terrain); state.terrain = null; }
        if (state.fogSystem) { scene.remove(state.fogSystem); state.fogSystem = null; }
        if (state.cityGroup) { scene.remove(state.cityGroup); state.cityGroup = null; }
        if (state.cloudMesh) { scene.remove(state.cloudMesh); state.cloudMesh = null; state.clouds = []; }

        // Remove Bridge
        if (bridgeGroup) {
            scene.remove(bridgeGroup);
            // Also clear voxel map? Yes
            bridgeVoxelMap.clear();
        }

        // Remove Dynamic
        if (state.shipGroup) { scene.remove(state.shipGroup); state.shipGroup = null; state.ships = []; }
        if (state.birdMesh) { scene.remove(state.birdMesh); state.birdMesh = null; state.birds = []; }
        if (state.lampPostMesh) { scene.remove(state.lampPostMesh); state.lampPostMesh = null; } // Fixed variable name

        // Clear global arrays used in updates
        cleanupTraffic(scene);
    }
}
