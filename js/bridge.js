import * as THREE from 'three';
import { state } from './state.js';

export function createBridge(scene) {
    const bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    const orangeMaterial = new THREE.MeshStandardMaterial({ color: 0xf04a00, roughness: 0.4 });
    const greyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });

    function createInstancedVoxels(data, material) {
        if (data.length === 0) return;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.InstancedMesh(geometry, material, data.length);
        const dummy = new THREE.Object3D();

        data.forEach((d, i) => {
            dummy.position.set(d.x, d.y, d.z);
            dummy.scale.set(d.sx, d.sy, d.sz);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        bridgeGroup.add(mesh);
        return mesh;
    }

    const orangeVoxels = [];
    const greyVoxels = [];

    const towerHeight = 220;
    const towerWidth = 30;
    const towerDepth = 20;
    const towerSpacing = 1280;
    const deckHeight = 67;

    function buildTower(x) {
        const legDist = 40;
        orangeVoxels.push({ x: x, y: towerHeight / 2 - 20, z: legDist, sx: towerWidth, sy: towerHeight, sz: towerDepth });
        orangeVoxels.push({ x: x, y: towerHeight / 2 - 20, z: -legDist, sx: towerWidth, sy: towerHeight, sz: towerDepth });

        for (let y = deckHeight + 20; y < towerHeight - 20; y += 40) {
            orangeVoxels.push({ x: x, y: y, z: 0, sx: towerWidth - 5, sy: 10, sz: legDist * 2 });
        }

        orangeVoxels.push({ x: x, y: towerHeight - 10, z: 0, sx: towerWidth + 5, sy: 20, sz: legDist * 2 + towerDepth });

        // Beacon
        const beacon = new THREE.PointLight(0xff0000, 0, 500);
        beacon.position.set(x, towerHeight + 10, 0);
        scene.add(beacon);
        state.towerBeacons.push(beacon);

        // Visual beacon mesh
        orangeVoxels.push({ x: x, y: towerHeight + 5, z: 0, sx: 4, sy: 10, sz: 4 });
    }

    buildTower(-towerSpacing / 2);
    buildTower(towerSpacing / 2);

    const totalLength = 2800;
    greyVoxels.push({ x: 0, y: deckHeight, z: 0, sx: totalLength, sy: 2, sz: 80 });
    orangeVoxels.push({ x: 0, y: deckHeight - 5, z: 0, sx: totalLength, sy: 8, sz: 70 });

    function buildCable(zOffset) {
        const segments = 200;
        const span = towerSpacing;
        const sag = 150;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = -span / 2 + t * span;
            const y = towerHeight - 4 * sag * Math.pow((x) / span, 2);
            orangeVoxels.push({ x: x, y: y, z: zOffset, sx: 2, sy: 2, sz: 2 });

            if (Math.abs(x) % 40 < 2) {
                orangeVoxels.push({ x: x, y: (y + deckHeight) / 2, z: zOffset, sx: 1, sy: y - deckHeight, sz: 1 });
            }
        }

        const sideLen = (totalLength - span) / 2;
        for (let i = 0; i <= 50; i++) {
            const t = i / 50;
            let x = -span / 2 - t * sideLen;
            let y = towerHeight - t * (towerHeight - deckHeight);
            orangeVoxels.push({ x: x, y: y, z: zOffset, sx: 2, sy: 2, sz: 2 });
            if (i % 5 === 0) orangeVoxels.push({ x: x, y: (y + deckHeight) / 2, z: zOffset, sx: 1, sy: y - deckHeight, sz: 1 });

            x = span / 2 + t * sideLen;
            y = towerHeight - t * (towerHeight - deckHeight);
            orangeVoxels.push({ x: x, y: y, z: zOffset, sx: 2, sy: 2, sz: 2 });
            if (i % 5 === 0) orangeVoxels.push({ x: x, y: (y + deckHeight) / 2, z: zOffset, sx: 1, sy: y - deckHeight, sz: 1 });
        }
    }

    buildCable(42);
    buildCable(-42);

    createInstancedVoxels(orangeVoxels, orangeMaterial);
    createInstancedVoxels(greyVoxels, greyMaterial);
}
