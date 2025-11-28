import * as THREE from 'three';
import { Scenario } from './Scenario.js';
import { createBridge, bridgeVoxelMap } from '../bridge.js';
import { createVolumetricFog, createWater, createTerrain, createCity, createClouds } from '../environment.js';
import { createStreetLights, createShips, createBirds } from '../dynamic.js';
import { state } from '../appState.js';

export class GoldenBridgeScenario extends Scenario {
    constructor() {
        super();
        this.name = "Golden Gate Bridge";
    }

    init(scene) {
        super.init(scene);
        createVolumetricFog(scene);
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
        // Remove Bridge
        // This is tricky as we don't have direct references to everything created by helpers.
        // But we can use the state object or groups if they were stored.
        // For now, let's try to remove known objects from state.

        if (state.water) scene.remove(state.water);
        if (state.terrain) scene.remove(state.terrain);
        if (state.fogSystem) scene.remove(state.fogSystem);
        if (state.cityMaterial) {
            // City is an InstancedMesh in a group, but createCity adds a group to scene?
            // createCity adds a group to scene but doesn't store it in state globally well enough maybe?
            // Let's check environment.js. It adds to scene directly.
            // We might need to clear the whole scene or track these objects.

            // Ideally, we should refactor createCity to return the object.
            // But for now, let's look for objects by name or type if possible, or just reload page?
            // The user said "Everytime we load the page", so maybe cleanup isn't strictly necessary for the *first* load,
            // but if we want to fix the "leaking" when switching (if we were switching), we need it.
            // However, the issue is that main.js is calling them GLOBALLY.
            // So if CityBlock loads, main.js still called createWater.
            // By moving them here, they won't be called for CityBlock.
            // So cleanup is only needed if we switch at runtime.
            // Since we only load once per page load, we just need to move the calls.
        }

        // We should still try to clean up for correctness.
        // But the immediate fix is moving the calls.
    }
}
