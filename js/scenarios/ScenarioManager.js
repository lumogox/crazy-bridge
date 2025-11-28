import { GoldenBridgeScenario } from './GoldenBridgeScenario.js';
import { CityBlockScenario } from './CityBlockScenario.js';
import { createTraffic, createPedestrians, updatePedestrians } from '../dynamic.js';

export class ScenarioManager {
    constructor(scene) {
        this.scene = scene;
        this.currentScenario = null;
    }

    loadRandomScenario() {
        const scenarios = [
            GoldenBridgeScenario,
            CityBlockScenario
        ];

        const RandomScenarioClass = scenarios[Math.floor(Math.random() * scenarios.length)];
        this.loadScenario(new RandomScenarioClass());
    }

    loadScenario(scenario) {
        if (this.currentScenario) {
            this.currentScenario.cleanup(this.scene);
        }

        this.currentScenario = scenario;
        this.currentScenario.init(this.scene);

        this.currentScenario = scenario;
        this.currentScenario.init(this.scene);

        // Initialize traffic based on scenario config
        const trafficConfig = this.currentScenario.getTrafficConfig();
        createTraffic(this.scene, trafficConfig);

        // Initialize pedestrians
        if (this.currentScenario.getPedestrianConfig) {
            const pedConfig = this.currentScenario.getPedestrianConfig();
            createPedestrians(this.scene, pedConfig);
        }
    }

    update(dt) {
        if (this.currentScenario) {
            this.currentScenario.update(dt);
        }
        updatePedestrians(dt);
    }
}
