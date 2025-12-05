import * as THREE from 'three';
import { Scenario } from './Scenario.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { cleanupTraffic } from '../dynamic.js';

export class CityBlockScenario extends Scenario {
    constructor() {
        super();
        this.name = "City Block in a Rock";
        this.voxels = [];
    }

    init(scene) {
        super.init(scene);
        console.log("Initializing City Block Scenario");

        this.group = new THREE.Group();
        scene.add(this.group);

        this.createRockBase();
        this.createStreets();
        this.createBuildings();
    }

    createRockBase() {
        // Big rock base
        const geometry = new THREE.DodecahedronGeometry(800, 1); // Scaled up 2x
        // Flatten top
        const pos = geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            if (pos.getY(i) > 50) pos.setY(i, 50);
        }
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9,
            flatShading: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0;
        this.group.add(mesh);
    }

    createStreets() {
        // Grid of streets
        // Main street X axis (rotated from Z)
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });

        // Road (1200 length on X, 200 width on Z - scaled up)
        const roadGeo = new THREE.BoxGeometry(1200, 2, 200);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.set(0, 51, 0);
        road.receiveShadow = true;
        this.group.add(road);

        // Sidewalks
        const swGeo = new THREE.BoxGeometry(1200, 3, 80);

        const swLeft = new THREE.Mesh(swGeo, sidewalkMat);
        swLeft.position.set(0, 51.5, -140); // Z offset
        swLeft.receiveShadow = true;
        this.group.add(swLeft);

        const swRight = new THREE.Mesh(swGeo, sidewalkMat);
        swRight.position.set(0, 51.5, 140); // Z offset
        swRight.receiveShadow = true;
        this.group.add(swRight);
    }

    createBuildings() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x88aabb });
        const geo = new THREE.BoxGeometry(120, 200, 120); // Scaled up

        // Simple rows of buildings along X axis
        for (let x = -500; x <= 500; x += 160) {
            const b1 = new THREE.Mesh(geo, mat);
            b1.position.set(x, 150, -260); // Z offset
            b1.castShadow = true;
            b1.receiveShadow = true;
            this.group.add(b1);

            const b2 = new THREE.Mesh(geo, mat);
            b2.position.set(x, 150, 260); // Z offset
            b2.castShadow = true;
            b2.receiveShadow = true;
            this.group.add(b2);
        }
    }

    getTrafficConfig() {
        return {
            count: 100,
            length: 1200, // Scaled up
            y: 52, // Just above road at 51
            groundCheck: false, // No voxel map for city yet
            lanes: [
                // Lanes along X axis (Z is constant)
                // dir 1 = +X, dir -1 = -X
                { z: 30, dir: 1 },
                { z: 10, dir: 1 },
                { z: -10, dir: -1 },
                { z: -30, dir: -1 }
            ]
        };
    }

    getPedestrianConfig() {
        return {
            count: 50,
            areas: [
                // Areas along X axis
                { x: 0, y: 53, z: -140, width: 1200, length: 60, axis: 'x' },
                { x: 0, y: 53, z: 140, width: 1200, length: 60, axis: 'x' }
            ]
        };
    }

    update(dt) {

    }

    cleanup(scene) {
        if (this.group) {
            scene.remove(this.group);
        }
        cleanupTraffic(scene);
    }
}
