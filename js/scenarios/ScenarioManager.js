import { GoldenBridgeScenario } from './GoldenBridgeScenario.js';
import { CityBlockScenario } from './CityBlockScenario.js';
import { createTraffic, createPedestrians, updatePedestrians } from '../dynamic.js';
import { getSceneObjects } from '../scene.js';

export class ScenarioManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.currentScenario = null;
    }

    loadScenarioByName(name) {
        let ScenarioClass;
        switch (name) {
            case 'city':
                ScenarioClass = CityBlockScenario;
                break;
            case 'bridge':
            default:
                ScenarioClass = GoldenBridgeScenario;
                break;
        }
        this.loadScenario(new ScenarioClass());
    }

    loadScenario(scenario) {
        if (this.currentScenario) {
            this.currentScenario.cleanup(this.scene);
        }

        this.currentScenario = scenario;
        this.currentScenario.init(this.scene, this.renderer);

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
