import * as THREE from 'three';

export class Scenario {
    constructor() {
        this.name = "Base Scenario";
    }

    init(scene) {
        console.log(`Initializing ${this.name}`);
    }

    update(dt) {
        // Override
    }

    cleanup(scene) {
        console.log(`Cleaning up ${this.name}`);
    }

    getTrafficConfig() {
        return {
            lanes: [],
            spawnPoints: []
        };
    }
}
