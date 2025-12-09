import * as THREE from 'three';
import { Scenario } from './Scenario.js';
import { cleanupTraffic } from '../dynamic.js';
import { switchToMapControls, switchToOrbitControls, getSceneObjects } from '../scene.js';
import { state } from '../appState.js';

export class CityBlockScenario extends Scenario {
    constructor() {
        super();
        this.name = "Infinite City";
        this.buildings = [];
        this.savedFog = null;
        this.savedBackground = null;
    }

    init(scene) {
        super.init(scene);
        console.log("Initializing Infinite City Scenario");

        this.group = new THREE.Group();
        scene.add(this.group);

        // Save original scene settings
        this.savedFog = scene.fog;
        this.savedBackground = scene.background.clone();

        // Apply city fog and background (like the Three.js example)
        scene.background = new THREE.Color(0xcccccc);
        scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

        // Set city mode flag to prevent global fog override
        state.cityMode = true;

        // Switch to MapControls
        const sceneObjects = getSceneObjects();
        if (sceneObjects) {
            switchToMapControls(sceneObjects.camera);
            // Set initial camera position for city view
            sceneObjects.camera.position.set(0, 200, -400);
        }

        this.createGround();
        this.createStreets();
        this.createBuildings();
        this.createLighting();
    }

    createGround() {
        // Simple ground plane
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.group.add(ground);
    }

    createStreets() {
        // Main road running through the city (X axis)
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });

        // Main street (X axis)
        const roadGeo = new THREE.BoxGeometry(1600, 0.5, 60);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.set(0, 0.25, 0);
        road.receiveShadow = true;
        this.group.add(road);

        // Road markings - center line
        const lineGeo = new THREE.BoxGeometry(1600, 0.6, 0.5);
        const centerLine = new THREE.Mesh(lineGeo, lineMat);
        centerLine.position.set(0, 0.3, 0);
        this.group.add(centerLine);

        // Sidewalks
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const swGeo = new THREE.BoxGeometry(1600, 1, 20);

        const swLeft = new THREE.Mesh(swGeo, sidewalkMat);
        swLeft.position.set(0, 0.5, -40);
        swLeft.receiveShadow = true;
        this.group.add(swLeft);

        const swRight = new THREE.Mesh(swGeo, sidewalkMat);
        swRight.position.set(0, 0.5, 40);
        swRight.receiveShadow = true;
        this.group.add(swRight);
    }

    createBuildings() {
        // Create random buildings like the Three.js MapControls example
        const geometry = new THREE.BoxGeometry();
        geometry.translate(0, 0.5, 0); // So buildings sit on ground

        const material = new THREE.MeshPhongMaterial({
            color: 0xeeeeee,
            flatShading: true
        });

        // Define road exclusion zone (where cars drive)
        const roadZMin = -60;
        const roadZMax = 60;

        for (let i = 0; i < 500; i++) {
            const mesh = new THREE.Mesh(geometry, material);

            // Random position in 1600x1600 area
            let posX = Math.random() * 1600 - 800;
            let posZ = Math.random() * 1600 - 800;

            // Avoid placing buildings on the road
            if (posZ > roadZMin && posZ < roadZMax) {
                // Push to either side of the road
                posZ = posZ > 0 ? roadZMax + 20 + Math.random() * 20 : roadZMin - 20 - Math.random() * 20;
            }

            mesh.position.x = posX;
            mesh.position.y = 0;
            mesh.position.z = posZ;

            // Random building dimensions
            mesh.scale.x = 20;
            mesh.scale.y = Math.random() * 80 + 10;
            mesh.scale.z = 20;

            mesh.updateMatrix();
            mesh.matrixAutoUpdate = false;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.group.add(mesh);
            this.buildings.push(mesh);
        }
    }

    createLighting() {
        // Add additional directional lights (similar to the example)
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 2);
        dirLight1.position.set(1, 1, 1);
        this.group.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x002288, 2);
        dirLight2.position.set(-1, -1, -1);
        this.group.add(dirLight2);
    }

    getTrafficConfig() {
        return {
            count: 100,
            length: 1600,
            y: 1.5, // Just above ground
            groundCheck: false,
            lanes: [
                // Lanes along X axis (Z is constant)
                // dir 1 = +X, dir -1 = -X
                { z: 12, dir: 1 },
                { z: 6, dir: 1 },
                { z: -6, dir: -1 },
                { z: -12, dir: -1 }
            ]
        };
    }

    getPedestrianConfig() {
        return {
            count: 50,
            areas: [
                // Sidewalk areas
                { x: 0, y: 1.5, z: -40, width: 1600, length: 15, axis: 'x' },
                { x: 0, y: 1.5, z: 40, width: 1600, length: 15, axis: 'x' }
            ]
        };
    }

    update(dt) {
        // Update controls damping
        const sceneObjects = getSceneObjects();
        if (sceneObjects && sceneObjects.controls) {
            sceneObjects.controls.update();
        }
    }

    cleanup(scene) {
        console.log("Cleaning up Infinite City Scenario");

        // Restore original fog and background
        state.cityMode = false; // Disable city mode to restore global fog control
        if (this.savedFog) {
            scene.fog = this.savedFog;
        }
        if (this.savedBackground) {
            scene.background.copy(this.savedBackground);
        }

        // Switch back to OrbitControls
        const sceneObjects = getSceneObjects();
        if (sceneObjects) {
            switchToOrbitControls(sceneObjects.camera);
            // Reset camera position for bridge view
            sceneObjects.camera.position.set(500, 200, 500);
        }

        if (this.group) {
            scene.remove(this.group);
        }

        this.buildings = [];
        cleanupTraffic(scene);
    }
}
